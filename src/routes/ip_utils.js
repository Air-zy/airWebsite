const { firedbAdressGet, firedbAirsiteGet, firedbAnimeMapGet } = require('../firebasedb.js');

let updatedCurrentAdresses = null;
let compressedAnimeMap = null;
let projects = null;

(async () => {
  updatedCurrentAdresses = await firedbAdressGet();
  projects = await firedbAirsiteGet();
  compressedAnimeMap = await firedbAnimeMapGet()
  console.log("[FIRE DB] all init data loaded")
})();

let adressesLoaded = true;

function getIP(req) {
  const ipList = req.headers['x-forwarded-for']
  const ips = ipList.split(',')
  console.log(ips)

  for (let i = ips.length - 1; i >= 0; i--) {
    const ip = ips[i].trim();
    if (isValidIPv4(ip)) {
      return ip; 
    }
  }
}

function isValidIPv4(ip) {
  const parts = ip.trim().split('.');
  if (parts.length === 4) {
    return parts.every(part => {
      const num = Number(part);
      return num >= 0 && num <= 255 && part == num;
    });
  }
  return false;
}

function ipv4ToDecimal(ip) {
  const octets = ip.split(".").map(Number);
  return (
    (octets[0] << 24) +
    (octets[1] << 16) +
    (octets[2] << 8) +
    octets[3]
  ) >>> 0;
}

function bitset(num, pos) {
    return num | (1 << pos);
}

function getIPData(decimalIP) {
  return updatedCurrentAdresses[decimalIP]
}

function getIPData(decimalIP) {
  return updatedCurrentAdresses[decimalIP]
}

function getProjects() {
  return projects;
}

function getCompressedAnimeMap() {
  return compressedAnimeMap;
}

module.exports = {
  getIP,
  ipv4ToDecimal,
  bitset,
  isValidIPv4,
  getIPData,
  getProjects,
  getCompressedAnimeMap
};
