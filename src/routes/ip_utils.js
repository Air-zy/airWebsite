const { firedbAdressGet, firedbAirsiteGet, firedbAnimeMapGet, firedbAdressesSave } = require('../firebasedb.js');
const { ipLookup } = require('../ipLookup.js');

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
  for (let i = ips.length - 1; i >= 0; i--) {
    const ip = ips[i].trim();
    return ip; 
  }
}

function bitset(num, pos) {
    return num | (1 << pos);
}

function getIPData(ipString) {
  return updatedCurrentAdresses[ipString]
}

function getIPData(ipString) {
  return updatedCurrentAdresses[ipString]
}

function getProjects() {
  return projects;
}

function getCompressedAnimeMap() {
  return compressedAnimeMap;
}

let refererLookup = new Map();
function referLookup(ipString, req) {
  if (refererLookup.has(ipString)) {
    return refererLookup.get(ipString);
  }
  let referer = req.headers['referer'];
  if (Array.isArray(referer)) {
    referer = referer.find(r => typeof r === 'string' && r.trim()) || undefined;
  }

  if (typeof referer === 'string' && referer.trim() !== '') {
    refererLookup.set(ipString, referer);
    return referer;
  }
  return null;
}

async function updateCurrentAdressses(ipString, userAgent, referer) {
  const { region, city, ISP } = await ipLookup(ipString)

  let visits = 1;
  if (updatedCurrentAdresses[ipString] && updatedCurrentAdresses[ipString].visits) {
    visits = updatedCurrentAdresses[ipString].visits + 1;
  }
  let captcha = 0;
  if (updatedCurrentAdresses[ipString] && updatedCurrentAdresses[ipString].captcha) {
    captcha = updatedCurrentAdresses[ipString].captcha;
  }
  updatedCurrentAdresses[ipString] = {
    "user-agent": userAgent,
    city: city,
    isp: ISP,
    region: region,
    visits: visits,
    "captcha": captcha,
  };

  let user = updatedCurrentAdresses[ipString]
  user.prevAt = user.lastAt || Date.now();
  user.lastAt = Date.now();
  if (user.firstAt == null) {
    user.firstAt = Date.now();
  }
  
  if (referer) {
    const cleanReferer = referer.replace(/(^\w+:|^)\/\//, '');
    if (!user["referer"] || cleanReferer.startsWith("airzy.glitch.me")) {
      user["referer"] = referer;
    } 
  }

  if (adressesLoaded == false) {
    console.log("adresses not loaded... not saving bruh");
    return
  }
  firedbAdressesSave(updatedCurrentAdresses)
}

module.exports = {
  getIP,
  bitset,
  getIPData,
  getProjects,
  getCompressedAnimeMap,
  referLookup,
  updateCurrentAdressses,
};
