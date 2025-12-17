const { getFirestore, getApp } = require('./firebaseUtils');
const app = getApp(process.env.firebaseJsonKey2, "firedb2");
const firestore = getFirestore(app);

const collection = firestore.collection("def"); 
const docRef = collection.doc("anime")

async function fetchData() {
  try {
    const docSnap = await docRef.get();
    if (!docSnap.exists) {
      console.log('doc does not exist.');
      return { buffer: null, base64: null, raw: null };
    }

    const raw = docSnap.data();

    const base64 = (raw && typeof raw.data === 'string') ? raw.data : null;
    const buffer = base64 ? Buffer.from(base64, 'base64') : null;

    return { buffer, base64, raw };
  } catch (err) {
    console.error('Error fetching document:', err);
    throw err;
  }
}

module.exports = {
    fetchData
}