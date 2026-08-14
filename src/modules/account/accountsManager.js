const { firedbSecure } = require('../../firebase/firebasedb.js');
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
  if (pw.length > 200) throw new Error('password-too-long');
}

// deliberately loose. no RFC5322 monster, and no gmail dot or plus stripping,
// that breaks legitimate addresses.
function normalizeEmail(e) {
  if (typeof e !== 'string') throw new Error('email-invalid');
  const out = e.trim().toLowerCase();
  if (out.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(out)) throw new Error('email-invalid');
  return out;
}

async function register(name, email, password) {
  if (!name) throw new Error('name required');
  if (typeof name !== 'string') throw new Error('name required');

  name = normalizeUsername(name);
  validateUsername(name);
  email = normalizeEmail(email);
  validatePassword(password);

  const acc = new Account(name, email);
  await acc.setPassword(password);
  const payload = acc.serialize();

  const usernameIndexRef = firedbSecure.doc(`username:${name}`);
  const emailIndexRef = firedbSecure.doc(`email:${email}`);
  const counterRef = firedbSecure.doc(COUNTER_DOC_ID);

  const result = await firedbSecure.firestore.runTransaction(async (tx) => {
    // firestore needs all reads before any writes
    const uSnap = await tx.get(usernameIndexRef);
    if (uSnap.exists) {
      throw new Error('username-taken');
    }

    const eSnap = await tx.get(emailIndexRef);
    if (eSnap.exists) {
      throw new Error('email-taken');
    }

    const cSnap = await tx.get(counterRef);
    const nextId = (cSnap.exists && typeof cSnap.data().nextId === 'number') ? cSnap.data().nextId : 1;
    const uid = nextId;

    tx.set(counterRef, { nextId: uid + 1 }, { merge: true });
    tx.set(firedbSecure.doc(String(uid)), { ...payload, uid });
    tx.set(usernameIndexRef, { uid });
    tx.set(emailIndexRef, { uid });

    return { uid, name };
  });

  acc.uid = result.uid;
  return acc;
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

  const acc = Account.fromData(snap.data(), snap.id);

  const ok = await acc.verifyPassword(password);
  if (!ok) return null;

  return acc;
}

async function getAccountByEmail(email) {
  let norm;
  try {
    norm = normalizeEmail(email);
  } catch {
    return null;
  }

  const idx = await firedbSecure.doc(`email:${norm}`).get();
  if (!idx.exists) return null;
  return getAccountByUID(idx.data().uid);
}

// shared by reset confirm and change password
async function setAccountPassword(acc, newPassword) {
  validatePassword(newPassword);
  await acc.setPassword(newPassword);
  await firedbSecure.doc(String(acc.uid)).update({ passwordHash: acc.passwordHash });
}

async function getAccountByUID(uid) {
  const docRef = firedbSecure.doc(String(uid));
  const snap = await docRef.get();
  if (!snap.exists) return null;
  return Account.fromData(snap.data(), snap.id);
}

module.exports = {
  register,
  login,
  getAccountByUID,
  getAccountByEmail,
  setAccountPassword
};