const fetch = require('node-fetch');
const envDecrypt = require('../envDecrypt.js');

const { randomUserAgent } = require('./userAgents');
let t, i;

async function _req(urls) {
  const url = urls[i = (i + 1) % urls.length];
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': randomUserAgent(),
        'Accept': '*/*'
      },
      //signal: AbortSignal.timeout(15_000)
    });
    console.log(`GET ${url} → ${res.status}`);
  } catch (e) {
    console.error(`GET ${url} failed:`, e.message);
  }
}

const urls = JSON.parse(envDecrypt(process.env.airKey, process.env.heartUrls)).url

console.log("[Heart URLS]", envDecrypt(process.env.airKey, process.env.heartUrls))

function startCycler() {
  console.log("[Heart URLS start cycle]", envDecrypt(process.env.airKey, process.env.heartUrls))

  stopCycler();
  i = -1;
  _req(urls);
  t = setInterval(() => _req(urls), 1e4);
}

function stopCycler() {
  clearInterval(t);
}

module.exports = { startCycler, stopCycler };