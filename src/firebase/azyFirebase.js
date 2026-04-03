const { getFirestore, getApp } = require('./firebaseUtils');

const mainApp = getApp(process.env.azyFirebaseJSON, "azy");
const mainFirestore = getFirestore(mainApp);

const statusCollection = mainFirestore.collection('status');
const statusDoc = statusCollection.doc('main');

module.exports = {
    statusDoc
};