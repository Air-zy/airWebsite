const envDecrypt = require('../../FallbackEncryption/envDecrypt.js');
const rbxApiKey = envDecrypt(process.env.airKey, process.env.rowaCloudApi)

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

    // this returns a long running operation. it comes back done in practice, but if it
    // ever does not there is no response object and the old code threw on it.
    const data = await rbxApiRes.json();
    const imageUri = data && data.response && data.response.imageUri;
    if (!imageUri) return null;

    thumbCache[userid] = imageUri;
    return imageUri;
};

module.exports = { getThumb };
