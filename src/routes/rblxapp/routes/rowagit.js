//const fetch = require('node-fetch');
const envDecrypt = require('../../../FallbackEncryption/envDecrypt.js')
const repoPat = envDecrypt(process.env.airKey, process.env.repoPat)

function toBase64(str) {
  return Buffer.from(str, 'utf8').toString('base64');
}

async function game3git(filePath, filecontent, commitMessage) {
  const owner = 'Air-zy';
  const repo = 'robloxStudio';
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`;
  
  const content = toBase64(filecontent);
  const branch = "main"
  
  async function createOrUpdateFile() {
    console.log("[git]", url);
    try {
      // Check if the file exists
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${repoPat}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      });

      if (response.ok) {
        // File exists, update it
        const data = await response.json();
        const sha = data.sha; // SHA of the existing file
        await updateFile(sha);
      } else if (response.status === 404) {
        // File doesn't exist, create it
        await createFile();
      } else {
        console.error('[git] Unexpected response:', response);
      }
    } catch (error) {
      console.error('[git] Error:', error);
    }
  }

  async function updateFile(sha) {
    try {
      const updateResponse = await fetch(url, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${repoPat}`,
          'Accept': 'application/vnd.github.v3+json',
        },
        body: JSON.stringify({
          message: `UPD ${commitMessage}`,
          content: content,
          sha: sha,
          branch: branch,
        }),
      });
      if (updateResponse.ok) {
        console.log("[git] File updated successfully");
      } else {
        console.error("[git] Failed to update file:", updateResponse.statusText);
      }
    } catch (error) {
      console.error("[git] Error updating file:", error);
    }
  }

  async function createFile() {
    try {
      const createResponse = await fetch(url, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${repoPat}`,
          'Accept': 'application/vnd.github.v3+json',
        },
        body: JSON.stringify({
          message: `CREATE ${commitMessage}`,
          content: content,
          branch: branch,
        }),
      });
      if (createResponse.ok) {
        console.log("[git] File created successfully");
      } else {
        console.error("[git] Failed to create file:", createResponse);
      }
    } catch (error) {
      console.error("[git] Error creating file:", error);
    }
  }
  
  createOrUpdateFile();
}

module.exports = { game3git };