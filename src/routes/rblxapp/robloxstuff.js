const { firedbRobloxGet, firedbRobloxSave } = require('../../firebase/firebasedb.js');
const { fetchUsersByIds } = require('./rblxutils.js')
const zlib = require('zlib');

let last_gam3_comitted = {}
async function commitRblxData(receivedData) {
  last_gam3_comitted = receivedData
  const stringifiedData = JSON.stringify(receivedData)
  const compressedData = zlib.gzipSync(stringifiedData);
  const base64CompressedData = compressedData.toString('base64');
      
  const originalSize = Buffer.byteLength(stringifiedData);           // Size of the original object
  const compressedSize = Buffer.byteLength(base64CompressedData);    // Size of the gzipped data

  function formatSizeToMB(size) {
    const sizeInMB = size / (1024 * 1024);  // Convert bytes to MB
    return sizeInMB.toFixed(2).toLocaleString();  // Fixed to 2 decimal places and formatted with commas
  }

  firedbRobloxSave(base64CompressedData)
      
  console.log(`rblxDS | Original size: ${formatSizeToMB(originalSize)} MB`);
  console.log(`rblxDS | Compressed size: ${formatSizeToMB(compressedSize)} MB`);
}

let cache = {
  data: null,
  lastFetch: 0,
  cacheDuration: 60000 // 1 min
};

async function getRawRobloxData() {
  const compressedData = await firedbRobloxGet();
  const compressedBuffer = Buffer.from(compressedData.rblxdata, 'base64');
  return JSON.parse(zlib.gunzipSync(compressedBuffer));
}


async function processRblxData(decompressedData) {
  const map = decompressedData.PlrDataDSv3;
  if (!map || typeof map !== "object") return decompressedData;
  if (decompressedData.uidToName) {
    return decompressedData
  }

  const uidToName = Object.create(null);
  const needFetch = new Set();

  for (const [key, value] of Object.entries(map)) {
    if (!value || typeof value !== "object") continue;
    const maybeId = value.userId ?? value.UserId ?? value.id ?? key;
    const uid = Number(maybeId);
    if (!Number.isFinite(uid) || uid <= 0) continue;

    if (typeof value.Name === "string" && value.Name.trim()) {
      uidToName[uid] = value.Name;
    } else if (typeof value.name === "string" && value.name.trim()) {
      uidToName[uid] = value.name;
    } else {
      needFetch.add(uid);
    }
  }

  const idsToFetch = Array.from(needFetch);
  if (idsToFetch.length === 0) {
    decompressedData.uidToName = uidToName;
    console.log("no ids to fetch; uidToName size:", Object.keys(uidToName).length);
    return decompressedData;
  }

  console.log("fetching", idsToFetch.length, "ids...");
  const fetched = await fetchUsersByIds(idsToFetch);
  const fetchedCount = Object.values(fetched).filter(v => v != null).length;
  console.log(`got fetched ids: ${fetchedCount} / ${idsToFetch.length}`);

  for (const id of idsToFetch) {
    const user = fetched[id];
    const name = user ? (user.name ?? user.username ?? user.displayName ?? "") : "";
    uidToName[id] = name;
  }

  decompressedData.uidToName = uidToName;
  console.log("total uidToName entries:", Object.keys(uidToName).length);
  return decompressedData;
}


async function getRblxDataDecompressed() {
  const now = Date.now();

  if (cache.data && now - cache.lastFetch < cache.cacheDuration) {
    console.log("Returning cached data");
    if (last_gam3_comitted.length != 0 && JSON.stringify(last_gam3_comitted) != '{}') {
      return last_gam3_comitted
    } else {
      return cache.data;
    }
  }

  console.log("Fetching fresh data...");
  const decompressedData = await getRawRobloxData()// await firedbRobloxGet()
  const processedDecompData = await processRblxData(decompressedData)

  cache.data = processedDecompData;
  cache.lastFetch = now;

  return processedDecompData;
}

module.exports = { commitRblxData, getRblxDataDecompressed };