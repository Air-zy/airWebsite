const envDecrypt = require('../../FallbackEncryption/envDecrypt.js');
// one open cloud key for everything roblox, rblxutils and the rowa2 routes read it from here
const rbxApiKey = envDecrypt(process.env.airKey, process.env.rowaCloudApi)

// a second key with only legacy-asset:manage, for the rowa2 3d avatars. optional, without
// it the page keeps the 2d renders
const assetKey = process.env.rowaCloudApiLegacyAsset
    ? envDecrypt(process.env.airKey, process.env.rowaCloudApiLegacyAsset)
    : null;

// the rowa player datastore, list it or add /<userid> for one entry
const ENTRIES = 'https://apis.roblox.com/cloud/v2/universes/8502229770/data-stores/plrDataV3/scopes/global/entries';

// the entry value, undefined if roblox has none for that id
async function getPlrData(userid) {
    const rbxApiRes = await fetch(`${ENTRIES}/${encodeURIComponent(userid)}`, { headers: { 'x-api-key': rbxApiKey }});
    const data = await rbxApiRes.json();
    console.log(userid, data)
    return data.value;
}

// the cdn urls come back tagged 30DAY so they are stable for ages, and this shares
// the same 1k/min open cloud quota as the datastore crawl. worth not refetching.
const thumbCache = {};

async function getThumb(userid) {
    if (thumbCache[userid]) return thumbCache[userid];

    const url = `https://apis.roblox.com/cloud/v2/users/${userid}:generateThumbnail`;
    const rbxApiRes = await fetch(url, {
        headers: { 'x-api-key': rbxApiKey },
        signal: AbortSignal.timeout(8000)
    });
    if (!rbxApiRes.ok) return null;

    // long running operation, no response object until its done
    const data = await rbxApiRes.json();
    const imageUri = data && data.response && data.response.imageUri;
    if (!imageUri) return null;

    thumbCache[userid] = imageUri;
    return imageUri;
};

// raw asset bytes by id (models, meshes, images). keeps the promise so parallel asks share
// one download, and drops the oldest past the cap so big meshes cant pile up in memory
const ASSET_CACHE_MAX = 64 * 1024 * 1024;
const assetCache = new Map();
let assetBytes = 0;

function getAsset(id) {
    if (assetCache.has(id)) return assetCache.get(id);
    const job = (async () => {
        if (!assetKey) throw new Error('no asset key');
        const meta = await fetch(`https://apis.roblox.com/asset-delivery-api/v1/assetId/${id}`, {
            headers: { 'x-api-key': assetKey },
            signal: AbortSignal.timeout(8000)
        });
        if (!meta.ok) throw new Error(`asset ${id} ${meta.status}`);
        // a short lived cdn link, node fetch handles the gzip
        const { location } = await meta.json();
        const file = await fetch(location, { signal: AbortSignal.timeout(15000) });
        if (!file.ok) throw new Error(`asset ${id} cdn ${file.status}`);
        const buf = Buffer.from(await file.arrayBuffer());

        assetBytes += buf.length;
        for (const [k, v] of assetCache) {
            if (assetBytes <= ASSET_CACHE_MAX) break;
            if (v === job) continue;
            assetCache.delete(k);
            assetBytes -= (await v.catch(() => Buffer.alloc(0))).length;
        }
        return buf;
    })();
    assetCache.set(id, job);
    job.catch(() => assetCache.delete(id));
    return job;
}

module.exports = { rbxApiKey, assetKey, ENTRIES, getPlrData, getThumb, getAsset };
