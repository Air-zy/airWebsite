const fetch = require('node-fetch');
const envDecrypt = require('../envDecrypt.js');

const { randomUserAgent } = require('./userAgents');
let t, i;

async function _req(urls) {
  const url = urls[i = (i + 1) % urls.length];
  try {
    const myHeaders = {
      'User-Agent': randomUserAgent(),
      'Accept': '*/*'
    }
    console.log("headers", myHeaders)
    const res = await fetch(url, {
      headers: myHeaders,
      //signal: AbortSignal.timeout(15_000)
    });
    console.log(`[HEART] GET ${url} → ${res.status}`);
  } catch (e) {
    console.error(`[HEART] GET ${url} failed:`, e.message);
  }
}

const urls = JSON.parse(envDecrypt(process.env.airKey, process.env.heartUrls)).urls

function startCycler() {
  stopCycler();
  i = -1;
  _req(urls);
  t = setInterval(() => _req(urls), 2e4);
}

function stopCycler() {
  clearInterval(t);
}

module.exports = { startCycler, stopCycler };