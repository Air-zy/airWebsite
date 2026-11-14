const zlib = require('zlib');
const { promisify } = require('util');
const { getFirestore, getApp } = require('./firebaseUtils');

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

// init

const mainApp = getApp(process.env.firebaseJsonKey, "firedb1");
const mainFirestore = getFirestore(mainApp);

const firedb = mainFirestore.collection('tokenUsage');
const firedbSecure = mainFirestore.collection('secure');

// doc() only makes a reference, nothing is read until get()
const addrRef = firedb.doc('adresses2');
const airsiteRef = firedb.doc('airsite');
const robloxRef = firedb.doc('rblx');
// the my friends section on the home page, { groups, people } as site.js describes. kept here and not in the repo,
// which is public. people2 since groups and more than one link (2026-11-13), the old people doc is one flat
// { list: [{ name, url, why }] } that only a server from before reads
const peopleRef = firedb.doc('people2');

async function firedbAdressGet() {
  const snap = await addrRef.get();
  const snapData = snap.data()

  if (snapData.b64addrData) {
    const compressedBuffer = Buffer.from(snapData.b64addrData, 'base64')
    const jsonString = (await gunzip(compressedBuffer)).toString('utf8')
    const AddrDataRestored = JSON.parse(jsonString)

    return AddrDataRestored
  } else {
    console.log("addr Data b64addrData was not found")
    return {}
  }
}

async function firedbAirsiteGet() {
  const snap = await airsiteRef.get();
  return snap.data();
}

// label only shows up in the logs
async function _safeSet(documentRef, data, label, maxRetries = 3) {
  const count = Object.keys(data).length;

  if (count <= 0) {
    console.log(`no ${label} exist... not saving bruh`);
    return;
  }

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await documentRef.set(data);
      console.log(`updated ${label} (${count}) successfully written on attempt ${attempt}`);
      return; // success
    } catch (error) {
      console.error(`Error on attempt ${attempt}:`, error);

      if (attempt === maxRetries || error.code !== 4) {
        throw error;
      }

      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
}

let adrs_lastUpdate = 0
async function firedbAdressesSave(AddrData) {
  const now = Date.now();
  if (now > adrs_lastUpdate + 6000) {
    // 1000 ms = 1 sec sooo 6 second is max update rate limit rah
    adrs_lastUpdate = now;

    try {
      const json = JSON.stringify(AddrData)
      const b64addrData = await gzip(json)
      await _safeSet(addrRef, {b64addrData}, 'adresses');
    } catch (err) {
      console.log("safeset ERR: ",err)
    }
  }
}

async function firedbAirsiteSave(projects) {
  await _safeSet(airsiteRef, projects, 'projects');
}

// nobody and no groups when the doc isn't there yet
async function firedbPeopleGet() {
  const data = (await peopleRef.get()).data();
  return { groups: data?.groups ?? [], people: data?.people ?? [] };
}

async function firedbPeopleSave({ groups, people }) {
  await _safeSet(peopleRef, { groups, people }, 'people');
}

//

async function firedbRobloxGet() {
  const snap = await robloxRef.get();
  return snap.data();
}

async function firedbRobloxSave(rblxdata) {
  try {
    await robloxRef.set({rblxdata});
  } catch(err) {
    console.log("rblx commit ERR: ", err)
  }
}

module.exports = {
  firedbAdressGet,
  firedbAdressesSave,

  firedbAirsiteGet,
  firedbAirsiteSave,

  firedbRobloxGet,
  firedbRobloxSave,

  firedbPeopleGet,
  firedbPeopleSave,

  firedbSecure
};
