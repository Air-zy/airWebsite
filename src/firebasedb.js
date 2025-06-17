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

async function _safeSet2(documentRef, data2, maxRetries = 3) {
  const numOfProjs = Object.keys(data2).length;
   
  if (numOfProjs <= 0) {
    console.log("no projects exist... not saving bruh");
    return;
  }
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await documentRef.set(data2);
      console.log("updated projects (" + numOfProjs + ")" + ` successfully written on attempt ${attempt}`);
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

async function firedbAirsiteSave(projects) {
  if (!airsiteRef) {
    airsiteRef = firedb.doc("airsite");
  }
  if (airsiteRef) {
    await _safeSet2(airsiteRef, projects);
  }
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
  firedbAirsiteSave
};
