const envDecrypt = require('../../FallbackEncryption/envDecrypt.js');
const rbxApiKey = envDecrypt(process.env.airKey, process.env.rowaCloudApi)

async function getThumb(userid) {
    const url = `https://apis.roblox.com/cloud/v2/users/${userid}:generateThumbnail`;
    const rbxApiRes = await fetch(url, { headers: { 'x-api-key': rbxApiKey }});
    const data = await rbxApiRes.json();
    return data.response.imageUri
};

module.exports = { getThumb };
