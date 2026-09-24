const envDecrypt = require('../../FallbackEncryption/envDecrypt.js');
// one open cloud key for everything roblox, rblxutils and the rowa2 routes read it from here
const rbxApiKey = envDecrypt(process.env.airKey, process.env.rowaCloudApi)

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

module.exports = { rbxApiKey, ENTRIES, getPlrData, getThumb };
