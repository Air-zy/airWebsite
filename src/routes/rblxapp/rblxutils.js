const roUNameIDcache = {};

async function idtoname(userId) {
    const cached = roUNameIDcache[userId];
    if (cached) return cached;

    const response = await fetch(`https://users.roblox.com/v1/users/${userId}`);
    if (!response.ok) {
        throw new Error(`Failed to fetch user data from ${response.url}: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    roUNameIDcache[userId] = data;
    return data;
}

async function fetchUsersByIds(ids, opts = {}) {
    if (!Array.isArray(ids)) throw new TypeError("ids must be an array");
    const {
        url = "https://users.roproxy.com/v1/users",
        chunkSize = 200,
        maxRetries = 5,
        delayBetweenChunks = 200
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
        let backoff = 500;
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

    return out;
}

module.exports = { idtoname, fetchUsersByIds };
