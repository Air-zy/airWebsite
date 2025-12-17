const envDecrypt = require('../FallbackEncryption/envDecrypt.js');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

function getApp(firebaseJsonKey, appName) {
    const certCred = JSON.parse(envDecrypt(process.env.airKey, firebaseJsonKey));
    const app = initializeApp({
        credential: cert(
            certCred
        )
    }, appName);

    console.log("[FIRE BASE] APP LOADED", app.options.credential.projectId)

    return app;
}

module.exports = {
    getFirestore,
    getApp
}