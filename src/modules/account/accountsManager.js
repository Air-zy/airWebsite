const crypto = require('crypto');
const { RegExpMatcher, englishDataset, englishRecommendedTransformers } = require('obscenity');
const { firedbSecure } = require('../../firebase/firebasedb.js');
const Account = require('./account.js');
const COUNTER_DOC_ID = 'counter';

const profanity = new RegExpMatcher({ ...englishDataset.build(), ...englishRecommendedTransformers });

function normalizeUsername(name) {
  return name.trim().normalize('NFC').toLowerCase();
}

// same rules as the webgame repo, plus two that only matter here
function validateUsername(name) {
  if (name.length < 3 || name.length > 32) throw new Error('username-invalid');
  // any script. marks capped at 3 per letter like notes.js, a zalgo name would spill over the guestbook
  if (!/^(?:[\p{L}\p{N}_]\p{M}{0,3})+$/u.test(name)) throw new Error('username-invalid');
  // login reads an all digit identifier as a uid, so this name could never log in
  if (/^\d+$/.test(name)) throw new Error('username-invalid');
  // underscores out first or f_u_c_k slips past the matcher
  if (profanity.hasMatch(name.replace(/_/g, ''))) throw new Error('username-inappropriate');
  if (name.length >= 6 && new Set(name).size / name.length < 0.3) throw new Error('username-repetitive');
}


// everything the validators here throw. the auth routes answer these with a 400 and the code as is
const INPUT_ERRORS = ['username-invalid', 'username-inappropriate', 'username-repetitive', 'password-too-short', 'password-too-long', 'password-required'];

function validatePassword(pw) {
  if (!pw || typeof pw !== 'string') throw new Error('password-required');
  if (pw.length < 8) throw new Error('password-too-short');
  if (pw.length > 200) throw new Error('password-too-long');
}

function isValidUsername(name) {
  try { validateUsername(name); return true; } catch { return false; }
}

function cleanUsername(name) {
  if (typeof name !== 'string') throw new Error('username-invalid');
  name = normalizeUsername(name);
  validateUsername(name);
  return name;
}

// one transaction so two signups cant take the same name or uid.
// extraRef is one more index doc claimed with it, google:<sub> for google accounts
async function createAccount(acc, extraRef) {
  const nameRef = firedbSecure.doc(`username:${acc.name}`);
  const counterRef = firedbSecure.doc(COUNTER_DOC_ID);

  acc.uid = await firedbSecure.firestore.runTransaction(async (tx) => {
    // firestore needs all reads before any writes
    if ((await tx.get(nameRef)).exists) throw new Error('username-taken');
    if (extraRef && (await tx.get(extraRef)).exists) throw new Error('already-linked');

    const cSnap = await tx.get(counterRef);
    const uid = (cSnap.exists && typeof cSnap.data().nextId === 'number') ? cSnap.data().nextId : 1;

    tx.set(counterRef, { nextId: uid + 1 }, { merge: true });
    tx.set(firedbSecure.doc(String(uid)), { ...acc.serialize(), uid });
    tx.set(nameRef, { uid });
    if (extraRef) tx.set(extraRef, { uid });
    return uid;
  });

  return acc;
}

async function register(name, password) {
  name = cleanUsername(name);
  validatePassword(password);

  const acc = new Account(name);
  await acc.setPassword(password);
  return createAccount(acc);
}

// first name only. the full name or the email would put who they are on the public guestbook.
// checked with digits on since thats the longest it gets, anything the rules reject becomes user
function googleNameBase(givenName) {
  const base = [...normalizeUsername(String(givenName ?? ''))
    .replace(/\s+/g, '_')
    .replace(/[^\p{L}\p{N}\p{M}_]/gu, '')].slice(0, 24).join('');
  return isValidUsername(base + '1234') ? base : 'user';
}

// sub is googles id for the person, it never changes even if their email does
async function loginWithGoogle(sub, givenName) {
  const googleRef = firedbSecure.doc(`google:${sub}`);
  const linked = await googleRef.get();
  if (linked.exists) return getAccountByUID(linked.data().uid);

  // no password, so password login and change password never work for these
  const base = googleNameBase(givenName);
  // the bare name first, then random digits. they can rename from the profile page
  for (let i = 0; i < 5; i++) {
    const name = i ? base + crypto.randomInt(1000, 10000) : base;
    if (!isValidUsername(name)) continue;
    try {
      return await createAccount(new Account(name), googleRef);
    } catch (err) {
      if (err.message === 'already-linked') return loginWithGoogle(sub); // another tab finished first
      if (err.message !== 'username-taken') throw err;
    }
  }
  throw new Error('username-taken');
}

// uid -> name for the guestbook, so a public page load costs no firestore reads once warm.
// ponytail: one process only, a second server would show old names after a rename until restart
const nameCache = new Map();

// names in the same order as uids, null for a deleted account
async function getNames(uids) {
  const missing = [...new Set(uids)].filter(uid => !nameCache.has(uid));
  if (missing.length) {
    const refs = missing.map(uid => firedbSecure.doc(String(uid)));
    for (const snap of await firedbSecure.firestore.getAll(...refs, { fieldMask: ['name'] }))
      nameCache.set(Number(snap.id), snap.exists ? snap.get('name') : null);
  }
  return uids.map(uid => nameCache.get(uid));
}

async function renameAccount(uid, newName) {
  newName = cleanUsername(newName);
  const accRef = firedbSecure.doc(String(uid));
  const newRef = firedbSecure.doc(`username:${newName}`);

  await firedbSecure.firestore.runTransaction(async (tx) => {
    const [accSnap, taken] = await tx.getAll(accRef, newRef);
    if (!accSnap.exists) throw new Error('not-authenticated');
    const old = accSnap.get('name');
    if (old === newName) return;
    if (taken.exists) throw new Error('username-taken');

    // the old name is free straight away. notes look names up by uid so they follow the rename
    tx.delete(firedbSecure.doc(`username:${old}`));
    tx.set(newRef, { uid: Number(uid) });
    tx.update(accRef, { name: newName });
  });

  nameCache.set(Number(uid), newName);
  return newName;
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
  INPUT_ERRORS,
  register,
  login,
  loginWithGoogle,
  renameAccount,
  getNames,
  getAccountByUID,
  setAccountPassword
};

// node --env-file=.env src/modules/account/accountsManager.js
if (require.main === module) {
  const a = require('assert');
  const why = n => { try { validateUsername(normalizeUsername(n)); return 'ok'; } catch (e) { return e.message; } };

  for (const n of ['airzy', 'Cool_Guy', '123abc', 'josé', 'नमस्ते', 'สวัสดี', '名前です', 'abcdefghij'.repeat(3) + 'ab', 'grass_hopper'])
    a.strictEqual(why(n), 'ok', n);

  a.strictEqual(why('ab'), 'username-invalid');
  a.strictEqual(why('abcdefghij'.repeat(3) + 'abc'), 'username-invalid');
  a.strictEqual(why('cool-guy'), 'username-invalid');
  a.strictEqual(why('a b'), 'username-invalid');
  a.strictEqual(why('😀😀😀'), 'username-invalid');
  a.strictEqual(why('12345'), 'username-invalid', 'would be read as a uid on login');
  a.strictEqual(why('abc' + '̶'.repeat(4)), 'username-invalid', 'zalgo');
  a.strictEqual(why('́abc'), 'username-invalid', 'leading mark');
  a.strictEqual(why('abc' + '̶'.repeat(3)), 'ok', '3 marks is fine');
  a.strictEqual(why('sh1t'), 'username-inappropriate');
  a.strictEqual(why('f_u_c_k'), 'username-inappropriate');
  a.strictEqual(why('aaaaaaab'), 'username-repetitive');

  a.strictEqual(googleNameBase('Airzy'), 'airzy');
  a.strictEqual(googleNameBase('Mary Jane'), 'mary_jane');
  a.strictEqual(googleNameBase('José'), 'josé');
  a.strictEqual(googleNameBase("O'Neil-Smith"), 'oneilsmith');
  a.strictEqual(googleNameBase('Al'), 'al', 'too short alone, fine once digits go on');
  a.strictEqual(googleNameBase(''), 'user');
  a.strictEqual(googleNameBase(undefined), 'user');
  a.strictEqual(googleNameBase('😀'), 'user');
  a.strictEqual(googleNameBase('123'), 'user', 'all digits would read as a uid');
  a.strictEqual(googleNameBase('sh1t'), 'user');
  a.strictEqual(googleNameBase('abcdefghij'.repeat(4)).length, 24);

  console.log('usernames ok');
  process.exit(0);
}
