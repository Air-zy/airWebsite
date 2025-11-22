const envDecrypt = require('../../../FallbackEncryption/envDecrypt.js');
const rbxApiKey = envDecrypt(process.env.airKey, process.env.rowaCloudApi)

module.exports = async (req, res) => {
  try {
    const universeId = '8502229770';
    const store = 'plrDataV3';
    const scope = 'global';

    const { userid } = req.params;

    const url = `https://apis.roblox.com/cloud/v2/universes/${universeId}/data-stores/${encodeURIComponent(store)}/scopes/${encodeURIComponent(scope)}/entries/${encodeURIComponent(userid)}`;

    const rbxApiRes = await fetch(url, { headers: { 'x-api-key': rbxApiKey }});
    const data = await rbxApiRes.json();

    console.log(userid, data)
    res.json(data.value);
  } catch (err) {
    res.status(500).json({ error: 'plr data request err' });
  }
};
