// firestoreHelpers.js
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

// parse & init synchronously
const serviceAccount = JSON.parse(process.env.firebaseJsonKey);
initializeApp({ credential: cert(serviceAccount) });

const firedb = getFirestore().collection('tokenUsage');

// cached refs
let addrRef, airsiteRef, animeRef, activityRef, robloxRef;

async function firedbAdressGet() {
  if (!addrRef) addrRef = firedb.doc('adresses');
  const snap = await addrRef.get();
  return snap.data();
}

async function firedbAirsiteGet() {
  if (!airsiteRef) airsiteRef = firedb.doc('airsite');
  const snap = await airsiteRef.get();
  return snap.data();
}

async function firedbAnimeMapGet() {
  if (!animeRef) animeRef = firedb.doc('anime');
  const snap = await animeRef.get();
  return snap.data();
}

async function firedbActivityGet() {
  if (!activityRef) activityRef = firedb.doc('activity');
  const snap = await activityRef.get();
  return snap.data();
}

async function firedbRobloxGet() {
  if (!robloxRef) robloxRef = firedb.doc('rblx');
  const snap = await robloxRef.get();
  return snap.data();
}

module.exports = {
  firedbAdressGet,
  firedbAirsiteGet,
  firedbAnimeMapGet,
  firedbActivityGet,
  firedbRobloxGet,
};
