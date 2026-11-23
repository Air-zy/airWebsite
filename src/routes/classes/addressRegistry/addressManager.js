const { firedbAdressGet, firedbAdressesSave } = require('../../../firebase/firebasedb.js');
const { ipLookup } = require('./ipLookup.js');
const Address = require('./adress.js');

const addressMap = new Map();
let addressesLoaded = false;

// never rejects, a failed load tries again in a minute. until one works updateAddress saves nothing, so an empty list
// never goes over the real one
async function loadAddresses() {
  try {
    const raw = await firedbAdressGet();
    Object.entries(raw || {}).forEach(([ip, info]) => {
      addressMap.set(ip, Address.fromRaw(ip, info));
    });
    addressesLoaded = true;
    console.log('[ADDRESS] Loaded', addressMap.size, 'entries');
  } catch (err) {
    console.error('[ADDRESS] load failed, trying again in a minute:', err.message);
    setTimeout(loadAddresses, 60 * 1000);
  }
}

// the live instance, not a copy, so callers can flip captcha bits on it
function getAddress(ip) {
  return addressMap.get(ip);
}

async function updateAddress(ip, userAgent, referer, req) {
  if (!addressesLoaded) {
    console.warn('[ADDRESS] Not loaded yet; skipping save');
    return;
  }

  let addr = addressMap.get(ip);
  if (!addr) {
    addr = new Address(ip);
    addressMap.set(ip, addr);
  }

  // a returning visitor keeps their place, so check-host is asked once per ip and a block page from it can't write
  // over a good city. 'null ~' is what ipLookup gives when it found nothing, that one gets another try
  const known = addr.city && addr.city !== 'null ~';
  const lookupData = known ? { city: addr.city, region: addr.region, ISP: addr.isp } : await ipLookup(ip);
  addr.touch(userAgent, lookupData, referer);

  const plain = {};
  for (const [key, addressInstance] of addressMap.entries()) {
    plain[key] = addressInstance.toJSON();
  }
  await firedbAdressesSave(plain);
}

module.exports = {
  loadAddresses,
  getAddress,
  updateAddress,
};
