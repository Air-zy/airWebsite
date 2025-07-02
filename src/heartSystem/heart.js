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
    //console.log(`[HEART] GET ${url} -> ${res.status}`,i);
  } catch (e) {
    console.error(`[HEART] GET ${url} failed:`,i , e.message);
  }
}

async function startCycler() {
  const response = await fetch("https://gist.githubusercontent.com/leonTrigi/1c586fd04360f7fc7d9c0645ca644e04/raw/78fe6dde5ec467269ca6e7cef781ee3cf68c5015/stf.txt");
  const heartUrls = await response.text();
  const urls = JSON.parse(envDecrypt(process.env.publicClusterKey, heartUrls)).urls

  stopCycler();
  i = -1;
  _req(urls);

  function cycle() {
    _req(urls);
    const interval = Math.floor(Math.random() * (240 - 60 + 1) + 60) * 1000;
    t = setTimeout(cycle, interval);
  }

  console.log("[HEART Started]", t)
  cycle();
}

function stopCycler() {
  clearTimeout(t);
}

module.exports = { startCycler, stopCycler };