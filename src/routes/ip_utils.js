const { firedbAdressGet } = require('../firebasedb.js');

let updatedCurrentAdresses = null;

(async () => {
  updatedCurrentAdresses = await firedbAdressGet();
})();


let adressesLoaded = true;

function getIP(req) {
  const ips = req.headers['x-forwarded-for'].split(',');
  if (req.headers['fastly-client-ip']) {
    const fastlyClientIP = req.headers['fastly-client-ip']
    const inIps = ips.some(item => item.trim() === fastlyClientIP.trim());
    if (fastlyClientIP && inIps) {
      if (isValidIPv4(fastlyClientIP)) {
        return fastlyClientIP;
      } else {
        console.log(fastlyClientIP, "not valid ip")
      }
    }
  }

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

module.exports = {
  getIP,
  ipv4ToDecimal,
  bitset,
  isValidIPv4,
  getIPData
};
