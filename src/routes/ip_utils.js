const { firedbAirsiteGet, firedbAnimeMapGet } = require('../firebasedb.js');

let compressedAnimeMap = null;
let projects = null;

(async () => {
  projects = await firedbAirsiteGet();
  compressedAnimeMap = await firedbAnimeMapGet()
  console.log("[FIRE DB] all init data loaded")
})();

function getIP(req) {
  const ipList = req.headers['x-forwarded-for']
  if (ipList) {
    const ips = ipList.split(',');
    const firstIp = ips[0].trim();
    return firstIp;
  }

  return req.connection?.remoteAddress ||
         req.socket?.remoteAddress ||
         req.connection?.socket?.remoteAddress ||
         null;
}

function bitset(num, pos) {
    return num | (1 << pos);
}

function getProjects() {
  return projects;
}

function getCompressedAnimeMap() {
  return compressedAnimeMap;
}

const {
  loadAddresses,
  getAddressMap,
  getIPData,
  updateAddress,
} = require('../addressRegistry/addressManager.js')

let lookupTBL = {};
function referLookup(ip, req) {

}

module.exports = {
  getIP,
  bitset,
  getIPData,
  getProjects,
  getCompressedAnimeMap,
  referLookup,
  updateAddress,
};
