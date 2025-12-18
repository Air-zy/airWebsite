const { getFirestore, getApp } = require('./firebaseUtils');
const app = getApp(process.env.firebaseJsonKey2, "firedb2");
const firestore = getFirestore(app);

const parentRef = firestore.collection('def').doc('anime');

const DEFAULT_CHUNK_SIZE = 200 * 1024; // 200 KiB -- to allow Firestore overhead
const BATCH_LIMIT = 500; // firestore max writes per batch

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

async function downloadAsBase64() {
  const metaSnap = await parentRef.get();
  if (!metaSnap.exists) throw new Error('Document metadata not found');

  const chunksSnap = await parentRef.collection('chunks').orderBy('index').get();
  const bufs = chunksSnap.docs.map(d => d.data().bytes); // admin SDK returns Buffer
  const assembled = Buffer.concat(bufs);
  return assembled.toString('base64');
}

const coordsRef = firestore.collection('def').doc('animeCoords');
async function coordsAsBase64() {
  const metaSnap = await coordsRef.get();
  if (!metaSnap.exists) throw new Error('Document metadata not found');

  const chunksSnap = await coordsRef.collection('chunks').orderBy('index').get();
  const bufs = chunksSnap.docs.map(d => d.data().bytes); // admin SDK returns Buffer
  const assembled = Buffer.concat(bufs);
  return assembled.toString('base64');
}

module.exports = { upload, downloadAsBase64, coordsAsBase64};
