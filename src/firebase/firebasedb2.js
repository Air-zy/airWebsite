const { getFirestore, getApp } = require('./firebaseUtils');
const mainApp = getApp(process.env.firebaseJsonKey2, "firedb2");
const mainFirestore = getFirestore(mainApp);

module.exports = {
    mainApp,
    mainFirestore
}