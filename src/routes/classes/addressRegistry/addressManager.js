const { firedbAdressGet, firedbAdressesSave } = require('../../../firebasedb.js');
const { ipLookup } = require('../../../ipLookup.js');
const Address = require('./adress.js');

const addressMap = new Map();
let addressesLoaded = false;

async function loadAddresses() {
  const raw = await firedbAdressGet();
  Object.entries(raw || {}).forEach(([ip, info]) => {
    addressMap.set(ip, Address.fromRaw(ip, info));
  });
  addressesLoaded = true;
  console.log('[ADDRESS] Loaded', addressMap.size, 'entries');
}

function getAddressMap() {
  return addressMap;
}

function getIPData(ip) {
  const addr = addressMap.get(ip);
  return addr ? addr.toJSON() : null;
}

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

  const lookupData = await ipLookup(ip);
  addr.touch(userAgent, lookupData, referer);

  const plain = {};
  for (const [key, addressInstance] of addressMap.entries()) {
    plain[key] = addressInstance.toJSON();
  }
  await firedbAdressesSave(plain);
}

module.exports = {
  loadAddresses,
  getAddressMap,
  getAddress,
  getIPData,
  updateAddress,
};
