const { firedbSecure } = require('../../firebasedb.js');
const Account = require('./account.js');
const COUNTER_DOC_ID = 'counter';

function normalizeUsername(name) {
  return name.trim().normalize('NFC').toLowerCase();
}

function validateUsername(name) {
  // letters (upper/lower), digits, underscore, hyphen
  // >= 3, <= 30
  const OK = /^[A-Za-z0-9_-]{3,30}$/;
  if (!OK.test(name)) throw new Error('username-invalid');
}


function validatePassword(pw) {
  if (!pw || typeof pw !== 'string') throw new Error('password-required');
  if (pw.length < 8) throw new Error('password-too-short');
}

async function register(name, password) {
  if (!name) throw new Error('name required');
  if (typeof name !== 'string') throw new Error('name required');

  name = normalizeUsername(name);
  validateUsername(name);
  validatePassword(password);

  const acc = new Account(name);
  await acc.setPassword(password);
  const payload = acc.serialize();

  const usernameIndexRef = firedbSecure.doc(`username:${name}`);
  const counterRef = firedbSecure.doc(COUNTER_DOC_ID);

  const result = await firedbSecure.firestore.runTransaction(async (tx) => {
    const uSnap = await tx.get(usernameIndexRef);
    if (uSnap.exists) {
      throw new Error('username-taken');
    }

    const cSnap = await tx.get(counterRef);
    const nextId = (cSnap.exists && typeof cSnap.data().nextId === 'number') ? cSnap.data().nextId : 1;
    const uid = nextId;

    tx.set(counterRef, { nextId: uid + 1 }, { merge: true });
    tx.set(firedbSecure.doc(String(uid)), payload);
    tx.set(usernameIndexRef, { uid });

    return { uid, name };
  });

  const createdSnap = await firedbSecure.doc(String(result.uid)).get();
  const createdData = createdSnap.data();
  const createdAccount = Account.fromData(createdData);

  return createdAccount;
}

async function login(identifier, password) {
  if (!identifier) return null;
  if (!password) return null;

  let uid = null;
  if (typeof identifier === 'number' || String(identifier).match(/^\d+$/)) {
    uid = String(identifier);
  } else {
    const normUsername = normalizeUsername(String(identifier))
    const idxRef = firedbSecure.doc(`username:${normUsername}`);
    const idxSnap = await idxRef.get();
    if (!idxSnap.exists) return null;
    uid = String(idxSnap.data().uid);
  }

  const snap = await firedbSecure.doc(uid).get();
  if (!snap.exists) return null;

  const data = snap.data();
  const acc = Account.fromData(data);

  const ok = await acc.verifyPassword(password);
  if (!ok) return null;
  return acc;
}

async function getAccountByUID(uid) {
  const docRef = firedbSecure.doc(String(uid));
  const snap = await docRef.get();
  if (!snap.exists) return null;
  return Account.fromData(snap.data());
}

module.exports = {
  register,
  login,
  getAccountByUID
};