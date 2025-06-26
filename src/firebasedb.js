// firestoreHelpers.js
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const envDecrypt = require('./envDecrypt.js')
// parse & init synchronously
const serviceAccount = JSON.parse(envDecrypt(process.env.airKey, process.env.firebaseJsonKey));
initializeApp({ credential: cert(serviceAccount) });

const firedb = getFirestore().collection('tokenUsage');
console.log("[FIREDB] LOADED",firedb)
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

async function _safeSet3(documentRef, animedata) {
  try {
    console.log("saving animeMap... ", typeof(animedata))
    await documentRef.set(animedata);
  } catch(err) {
    console.log("animeMap ERR: ", err)
  }
}

async function commitAnime(animeMap) {
  if (!animeRef) {
    animeRef = firedb.doc("anime");
  }

  if (animeRef) {
    const animeObj = Object.fromEntries(animeMap);
    //const jsonData = JSON.stringify(animeObj);
    //const compressedData = bzip2.compress(jsonData);
    const compressedData = zlib.gzipSync(JSON.stringify(animeObj));
    const base64CompressedData = compressedData.toString('base64');

    const originalSize = Buffer.byteLength(JSON.stringify(animeObj));  // sz of the original anime object
    const compressedSize = Buffer.byteLength(base64CompressedData);          // sz of the gzipped data
    
    function formatSizeToMB(size) {
      const sizeInMB = size / (1024 * 1024);  // bytes to MB
      return sizeInMB.toFixed(2).toLocaleString();  // fixd to 2 decimal places and formatted with commas
    }

    console.log(`animeData | Original size: ${formatSizeToMB(originalSize)} MB`);
    console.log(`animeData | Compressed size: ${formatSizeToMB(compressedSize)} MB`);
    
    await _safeSet3(animeRef, {base64CompressedData});
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
  commitAnime,
  firedbAdressGet,
  firedbAirsiteGet,
  firedbAnimeMapGet,
  firedbActivityGet,
  firedbRobloxGet,
  firedbAirsiteSave
};
