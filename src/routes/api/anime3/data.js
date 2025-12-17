
const envDecrypt = require('../../../FallbackEncryption/envDecrypt.js')
async function fetchFromDropbox(filename = 'graph.gz') {
    const dropboxToken = envDecrypt(process.env.airKey, process.env.dropboxToken);
    const res = await fetch('https://content.dropboxapi.com/2/files/download', {
        method: 'POST',
        headers: {
        'Authorization': 'Bearer ' + dropboxToken,
        'Dropbox-API-Arg': JSON.stringify({
            path: `/${filename}`
        })
        }
    });

    if (!res.ok) {
        throw new Error(`Dropbox download failed: ${await res.text()}`);
    }

    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer);
}

module.exports = async (req, res) => {
  try {
    const data = await fetchFromDropbox();
    res.send(data);
  } catch (err) {
    console.error('[anime3 get api] error:', err);
    res.status(500).json({ error: 'DROPBOX load error' });
  }
};
