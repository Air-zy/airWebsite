const fetch = require('node-fetch');
const envDecrypt = require('../envDecrypt.js');

const { randomUserAgent } = require('./userAgents');
let t, i;

async function _req(urls) {
  i = (i + 1) % urls.length
  const url = urls[i];
  try {
    const myHeaders = {
      'User-Agent': randomUserAgent(),
      'Accept': '*/*'
    }
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
  t = setInterval(() => _req(urls), 4e4);
}

function stopCycler() {
  clearInterval(t);
}

module.exports = { startCycler, stopCycler };