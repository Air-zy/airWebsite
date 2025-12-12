const { firedbSecure } = require('../../firebasedb.js');
const Account = require('./account.js');
const COUNTER_DOC_ID = 'counter';

async function register(name, password) {
    if (!name) throw new Error('name required');

    const usernameIndexRef = firedbSecure.doc(`username:${name}`);
    const counterRef = firedbSecure.doc(COUNTER_DOC_ID);

    const result = await firedbSecure.firestore.runTransaction(async (tx) => {

        const uSnap = await tx.get(usernameIndexRef);
        if (uSnap.exists) throw new Error('username-taken');

        const cSnap = await tx.get(counterRef);
        const nextId = (cSnap.exists && typeof cSnap.data().nextId === 'number') ? cSnap.data().nextId : 1;
        const uid = nextId;

        tx.set(counterRef, { nextId: uid + 1 }, { merge: true });

        //
        const acc = new Account(name);
        acc.uid = uid;
        await acc.setPassword(password);
        const payload = acc.serialize();
        tx.set(firedbSecure.doc(String(uid)), payload);
        tx.set(usernameIndexRef, { uid });

        return acc; // direct Account instance
    });

    return result;
}

async function login(identifier, password) {
    let uid = null;

    if (typeof identifier === 'number' || String(identifier).match(/^\d+$/)) {
        uid = String(identifier);
    } else {
        const idxRef = firedbSecure.doc(`username:${identifier}`);
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

async function getAccountByUid(uid) {
    const docRef = firedbSecure.doc(String(uid));
    const snap = await docRef.get();
    if (!snap.exists) return null;

    return Account.fromData(snap.data());
}

module.exports = {
    register,
    login,
    getAccountByUid
};
