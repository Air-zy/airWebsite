const envDecrypt = require('../FallbackEncryption/envDecrypt.js');

const { randomUserAgent } = require('./userAgents');

const stats = {
  total: 0,
  success: 0,
  failures: 0,
  lastError: null,
};

let t, i;

async function _req(urls) {
  i = (i + 1) % urls.length;
  const url = urls[i];

  try {
    stats.total++;
    const myHeaders = {
      'User-Agent': randomUserAgent(),
      'Accept': '*/*'
    };
    const res = await fetch(url, { headers: myHeaders });

    if (res.ok) {
      stats.success++;
    } else {
      stats.failures++;
      stats.lastError = `Non-OK status ${res.status}`;
      console.error(`[HEART] GET ${url} returned status ${res.status}`, i);
    }
  } catch (e) {
    stats.total++;
    stats.failures++;
    stats.lastError = e.message;
    console.error(`[HEART] GET ${url} failed:`, i, e.message);
  }
}

// peer list lives encrypted in a gist so it can change without a redeploy. /api/cluster-units hands out the same list
async function clusterUrls() {
  const response = await fetch(
    "https://gist.githubusercontent.com/leonTrigi/1c586fd04360f7fc7d9c0645ca644e04/raw/stf.txt"
  );
  const heartUrls = await response.text();
  return JSON.parse(envDecrypt(process.env.publicClusterKey, heartUrls)).urls;
}

async function startCycler() {
  stopCycler();
  i = -1;

  async function cycle() {
    try {
      _req(await clusterUrls());
    } catch (err) {
      console.error("[HEART Error]", err);
    }

    const interval = Math.floor(Math.random() * (10 - 2 + 1) + 2) * 60 * 1000;
    t = setTimeout(cycle, interval);
  }

  cycle();
  console.log("[HEART] started", t);
}

function stopCycler() {
  clearTimeout(t);
}

function getStatus() {
  return { ...stats }; // immutability heh
}

module.exports = { startCycler, stopCycler, getStatus, clusterUrls };
