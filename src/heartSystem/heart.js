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
    //console.log(`[HEART] GET ${url} → ${res.status}`,i);
  } catch (e) {
    console.error(`[HEART] GET ${url} failed:`,i , e.message);
  }
}

const urls = JSON.parse(envDecrypt(process.env.airKey, process.env.heartUrls)).urls

function startCycler() {
  stopCycler();
  i = -1;
  _req(urls);
  
  function cycle() {
    _req(urls);

    // between 60 and 240 seconds
    const interval = Math.floor(Math.random() * (240 - 60 + 1) + 60) * 1000;
    console.log("[HEART Cycle Scheduled]", interval, "ms");

    t = setTimeout(cycle, interval);
  }

  console.log("[HEART Started]", t)
  cycle();
}

function stopCycler() {
  clearTimeout(t);
}

module.exports = { startCycler, stopCycler };