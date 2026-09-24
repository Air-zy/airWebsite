const envDecrypt = require('../../../FallbackEncryption/envDecrypt.js')
const repoPat = envDecrypt(process.env.airKey, process.env.repoPat)

const headers = {
  'Authorization': `Bearer ${repoPat}`,
  'Accept': 'application/vnd.github.v3+json',
};

// create and update are the same PUT, an update just has to send the old sha
async function game3git(filePath, filecontent, commitMessage) {
  const url = `https://api.github.com/repos/Air-zy/robloxStudio/contents/${filePath}`;
  console.log("[git]", url);

  try {
    // Check if the file exists
    const response = await fetch(url, { headers });
    if (!response.ok && response.status !== 404) {
      return console.error('[git] Unexpected response:', response);
    }
    const sha = response.ok ? (await response.json()).sha : undefined;

    const putResponse = await fetch(url, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        message: `${sha ? 'UPD' : 'CREATE'} ${commitMessage}`,
        content: Buffer.from(filecontent, 'utf8').toString('base64'),
        sha, // undefined drops out of the json, which is what a create wants
        branch: 'main',
      }),
    });
    if (putResponse.ok) {
      console.log(`[git] File ${sha ? 'updated' : 'created'} successfully`);
    } else {
      console.error("[git] Failed to write file:", putResponse.status, putResponse.statusText);
    }
  } catch (error) {
    console.error('[git] Error:', error);
  }
}

module.exports = { game3git };
