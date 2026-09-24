const { getFirestore, getApp } = require('./firebaseUtils');
const app = getApp(process.env.firebaseJsonKey2, "firedb2");
const firestore = getFirestore(app);

const parentRef = firestore.collection('def').doc('anime');

const DEFAULT_CHUNK_SIZE = 200 * 1024; // 200 KiB -- to allow Firestore overhead
const BATCH_LIMIT = 500; // firestore max writes per batch

// no caller in here on purpose, its how the anime3 data gets refilled
async function upload(buf, chunkSize = DEFAULT_CHUNK_SIZE) {
  const totalBytes = buf.length;
  const chunkCount = Math.ceil(totalBytes / chunkSize);

  // meta
  await parentRef.set({
    totalBytes,
    chunkSize,
    chunkCount,
    uploadedAt: new Date()
  });

  // write chunks in batches
  let batch = firestore.batch();
  let writes = 0;
  for (let i = 0; i < chunkCount; i++) {
    const start = i * chunkSize;
    const end = Math.min(start + chunkSize, totalBytes);
    const slice = buf.slice(start, end);

    const chunkRef = parentRef.collection('chunks').doc(String(i).padStart(6, '0'));
    batch.set(chunkRef, { index: i, bytes: slice, length: slice.length });

    writes++;
    if (writes === BATCH_LIMIT) {
      await batch.commit();
      batch = firestore.batch();
      writes = 0;
    }
  }
  if (writes > 0) await batch.commit();

  return { totalBytes, chunkCount };
}

// every blob under def/ is a meta doc plus its chunks, glued back together in order.
// name is anime, animeCoords or animeCoords2
async function readChunks(name) {
  const ref = firestore.collection('def').doc(name);
  const metaSnap = await ref.get();
  if (!metaSnap.exists) throw new Error(`${name} metadata not found`);

  const chunksSnap = await ref.collection('chunks').orderBy('index').get();
  const bufs = chunksSnap.docs.map(d => d.data().bytes); // admin SDK returns Buffer

  console.log("got", name)
  return Buffer.concat(bufs).toString('base64');
}

module.exports = { upload, readChunks };
