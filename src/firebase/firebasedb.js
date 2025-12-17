const zlib = require('zlib');
const { getFirestore, getApp } = require('./firebaseUtils');

// moved here cuz ts the only one using it
// todo maybe use gzipSync insteaad of aall of this lmao
function gunzipAsync(buffer) {
  return new Promise((resolve, reject) => {
    zlib.gunzip(buffer, (err, result) => {
      if (err) return reject(err)
      resolve(result)
    })
  })
}

function gzipAsync(data) {
  return new Promise((resolve, reject) => {
    zlib.gzip(data, (err, result) => {
      if (err) return reject(err)
      resolve(result)
    })
  })
}


// init

const mainApp = getApp(process.env.firebaseJsonKey, "firedb1");
const mainFirestore = getFirestore(mainApp);

const firedb = mainFirestore.collection('tokenUsage');
const firedbSecure = mainFirestore.collection('secure');

// cached refs
let addrRef, airsiteRef, animeRef, activityRef, robloxRef, skillTreeRef;

async function firedbAdressGet() {
  if (!addrRef) addrRef = firedb.doc('adresses2');
  const snap = await addrRef.get();
  const snapData = snap.data()
  
  if (snapData.b64addrData) {
    const compressedBuffer = Buffer.from(snapData.b64addrData, 'base64')
    const jsonString = (await gunzipAsync(compressedBuffer)).toString('utf8')
    const AddrDataRestored = JSON.parse(jsonString)
    
    return AddrDataRestored
  } else {
    console.log("addr Data b64addrData was not found")
    return {}
  }
}

async function firedbAirsiteGet() {
  if (!airsiteRef) airsiteRef = firedb.doc('airsite');
  const snap = await airsiteRef.get();
  return snap.data();
}

async function _safeSet(documentRef, data, maxRetries = 3) {
  const numberOfIPs = Object.keys(data).length;
   
  if (numberOfIPs <= 0) {
    console.log("no addresses exist... not saving bruh");
    return;
  }
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await documentRef.set(data);
      console.log("updated adresses (" + numberOfIPs + ")" + ` successfully written on attempt ${attempt}`);
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
    
    if (!addrRef) {
      addrRef = firedb.doc("adresses2");
    }

    try {
      if (addrRef && addrRef != null) {
        const json = JSON.stringify(AddrData)
        const b64addrData = await gzipAsync(json)
        await _safeSet(addrRef, {b64addrData});
      }
    } catch (err) {
      console.log("safeset ERR: ",err)
    }
  }
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

async function _safeSet4(documentRef, animedata) {
  try {
    console.log("saving activity... ", typeof(animedata))
    await documentRef.set(animedata);
  } catch(err) {
    console.log("activity ERR: ", err)
  }
}


async function firedbActivitySet(activty) {
  if (!activityRef) {
    activityRef = firedb.doc("activity");
  }
  if (activityRef) {
    await _safeSet4(activityRef, activty);
  }
}

//

async function firedbRobloxGet() {
  if (!robloxRef) robloxRef = firedb.doc('rblx');
  const snap = await robloxRef.get();
  return snap.data();
}

async function firedbRobloxSave() {
  if (!robloxRef) {
    robloxRef = firedb.doc("rblx");
  }

  if (robloxRef) {
    try {
        await robloxRef.set({rblxdata});
    } catch(err) {
      console.log("rblx commit ERR: ", err)
    }
  }
}

//

async function skillTreeGet() {
  if (!skillTreeRef) skillTreeRef = firedb.doc('skilltree');
  const snap = await skillTreeRef.get();
  return snap.data();
}

async function skillTreeSave() {
  if (!skillTreeRef) {
    skillTreeRef = firedb.doc("skilltree");
  }

  if (skillTreeRef) {
    try {
        await skillTreeRef.set({rblxdata});
    } catch(err) {
      console.log("rblx commit ERR: ", err)
    }
  }
}

module.exports = {
  commitAnime,
  firedbAnimeMapGet,

  firedbAdressGet,
  firedbAdressesSave,

  firedbAirsiteGet,
  firedbAirsiteSave,

  firedbRobloxGet,
  firedbRobloxSave,

  firedbActivitySet,
  firedbActivityGet,

  skillTreeGet,
  skillTreeSave,

  firedbSecure
};