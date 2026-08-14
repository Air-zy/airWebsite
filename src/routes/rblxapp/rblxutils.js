const envDecrypt = require('../../FallbackEncryption/envDecrypt.js');
const rbxApiKey = envDecrypt(process.env.airKey, process.env.rowaCloudApi);

const roUNameIDcache = {};

// the open cloud key is shared with the datastore crawl in allPlrData, which already
// spends most of the 1k/min. cap the fallback so a bad roproxy day cannot starve it.
const OC_FALLBACK_CAP = 200;

// open cloud instead of users.roblox.com. single lookups are what this does anyway,
// and being authenticated means a 1k/min key quota instead of an ip throttle that
// was 429ing about two thirds of a leaderboard render.
async function idtoname(userId) {
    const cached = roUNameIDcache[userId];
    if (cached) return cached;

    const response = await fetch(`https://apis.roblox.com/cloud/v2/users/${userId}`, {
        headers: { 'x-api-key': rbxApiKey },
        signal: AbortSignal.timeout(8000)
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch user ${userId}: ${response.status} ${response.statusText}`);
    }

    // shape matches the old endpoint for the fields anyone uses, id name displayName
    const data = await response.json();
    roUNameIDcache[userId] = data;
    return data;
}

async function fetchUsersByIds(ids, opts = {}) {
    if (!Array.isArray(ids)) throw new TypeError("ids must be an array");
    // these used to be 5 retries at a 4s base, doubling. that is 4+8+16+32+64, so a
    // throttled roproxy stalled a page load for two minutes before giving up.
    // open cloud does the same job in a couple of seconds, so fail over quickly instead.
    const {
        url = "https://users.roproxy.com/v1/users",
        chunkSize = 200,
        maxRetries = 2,
        delayBetweenChunks = 1200
    } = opts;

    const uniqueIds = Array.from(new Set(ids.map(n => Number(n)).filter(Number.isFinite)));
    const out = Object.create(null);

    // Prefill with cached data if available
    const toFetch = [];
    for (const id of uniqueIds) {
        if (roUNameIDcache[id]) {
            out[id] = roUNameIDcache[id];
        } else {
            out[id] = null;
            toFetch.push(id);
        }
    }

    function chunkArray(arr, size) {
        const res = [];
        for (let i = 0; i < arr.length; i += size) res.push(arr.slice(i, i + size));
        return res;
    }

    function wait(ms) {
        return new Promise(r => setTimeout(r, ms));
    }

    async function postChunk(chunk) {
        let backoff = 600;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const resp = await fetch(url, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ userIds: chunk, excludeBannedUsers: false })
                });

                if (resp.ok) {
                    const json = await resp.json();
                    return Array.isArray(json) ? json : (json && json.data) ? json.data : [];
                }

                if (resp.status === 429 || (resp.status >= 500 && resp.status < 600)) {
                    console.log(attempt, resp.status)
                    if (attempt === maxRetries) throw new Error(`HTTP ${resp.status}`);
                    await wait(backoff);
                    backoff *= 2;
                    continue;
                }

                throw new Error(`HTTP ${resp.status} ${resp.statusText}`);
            } catch (err) {
                if (attempt === maxRetries) throw err;
                await wait(backoff);
                backoff *= 2;
            }
        }
        return [];
    }

    try {
        const chunks = chunkArray(toFetch, chunkSize);
        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            const data = await postChunk(chunk);
            for (const u of data) {
                const uid = Number(u.id ?? u.userId ?? u.user_id);
                if (Number.isFinite(uid)) {
                    roUNameIDcache[uid] = u;
                    out[uid] = u;
                }
            }
            if (i < chunks.length - 1) await wait(delayBetweenChunks);
        }
    } catch (err) {
        // used to be an empty catch. roproxy is shared and throttles hard, so a total
        // failure silently returned a map of nulls and the page just showed raw ids.
        console.error('[names] roproxy batch failed:', err.message);
    }

    // whatever roproxy did not return, ask open cloud one at a time. slower per user but
    // authenticated, so it still works when the shared proxy is refusing everyone.
    const missing = toFetch.filter(id => !out[id]);
    if (missing.length) {
        const take = missing.slice(0, OC_FALLBACK_CAP);
        if (missing.length > take.length) {
            console.warn(`[names] ${missing.length} missing, only falling back for ${take.length} to protect the open cloud quota`);
        } else {
            console.log(`[names] roproxy missed ${take.length}, falling back to open cloud`);
        }

        let i = 0;
        await Promise.all(Array.from({ length: Math.min(10, take.length) }, async () => {
            while (i < take.length) {
                const id = take[i++];
                // idtoname shares roUNameIDcache, so these get cached the same way
                const u = await idtoname(id).catch(() => null);
                if (u) out[id] = u;
            }
        }));
    }

    return out;
}

module.exports = { idtoname, fetchUsersByIds };
