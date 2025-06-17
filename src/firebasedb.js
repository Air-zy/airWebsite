const { initializeApp, applicationDefault, cert } = require('firebase-admin/app');
const { getFirestore, Timestamp, FieldValue, Filter } = require('firebase-admin/firestore');

// init Firebase Admin SDK
const serviceAccount = JSON.parse(process.env.firebaseJsonKey);
const firebaseApp = initializeApp({
  credential: cert(serviceAccount)
});

const firedb = getFirestore().collection('tokenUsage');

if (firebaseApp) {
  console.log("[FIREBASE] ready");
} else {
  console.error("[FIREBASE ERR] failed");
}

// cached doc references
let aTuringRef;
let aTuringRef2;
let aTuringRef3;
let aTuringRef4;
let aTuringRef5;

// to get 'adresses' data
async function firedbAdressGet() {
  try {
    if (!aTuringRef) {
      aTuringRef = firedb.doc("adresses");
    }
    const snapshot = await aTuringRef.get();
    return snapshot.data();
  } catch (err) {
    console.error("[FIREBASE ERR] firedbAdressGet", err);
    throw err;
  }
}

// to get 'airsite' d-data!
async function firedbAirsiteGet() {
  try {
    if (!aTuringRef2) {
      aTuringRef2 = firedb.doc("airsite");
    }
    const snapshot = await aTuringRef2.get();
    return snapshot.data();
  } catch (err) {
    console.error("[FIREBASE ERR] firedbAirsiteGet", err);
    throw err;
  }
}

// to get 'anime' dataa
async function firedbAnimeMapGet() {
  try {
    if (!aTuringRef3) {
      aTuringRef3 = firedb.doc("anime");
    }
    const snapshot = await aTuringRef3.get();
    return snapshot.data();
  } catch (err) {
    console.error("[FIREBASE ERR] firedbAnimeMapGet", err);
    throw err;
  }
}

// to get 'activity' daata
async function firedbActivityGet() {
  try {
    if (!aTuringRef4) {
      aTuringRef4 = firedb.doc("activity");
    }
    const snapshot = await aTuringRef4.get();
    return snapshot.data();
  } catch (err) {
    console.error("[FIREBASE ERR] firedbActivityGet", err);
    throw err;
  }
}

// to get 'rblx' data
async function firedbRobloxGet() {
  try {
    if (!aTuringRef5) {
      aTuringRef5 = firedb.doc("rblx");
    }
    const snapshot = await aTuringRef5.get();
    return snapshot.data();
  } catch (err) {
    console.error("[FIREBASE ERR] firedbRobloxGet", err);
    throw err;
  }
}

module.exports = {
  firedbAdressGet,
  firedbAirsiteGet,
  firedbAnimeMapGet,
  firedbActivityGet,
  firedbRobloxGet,
};
