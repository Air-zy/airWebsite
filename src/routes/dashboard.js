const { validateSession } = require('./classes/sessionRegistry/sessionManager.js');
const { getAddressMap } = require('./classes/addressRegistry/addressManager.js')

const envDecrypt = require('../FallbackEncryption/envDecrypt.js');
const airWebToken = envDecrypt(process.env.airKey, process.env.airWebToken)


module.exports = (req, res) => {
    if (req.body == undefined) {
        return res.status(400).json({ error: 'request body is missing'})
    }
    if (req.body.token == undefined) {
        return res.status(400).json({ error: 'token not found in request body'})
    }
    const token = req.body.token;
    const session = validateSession(token);
    if (session == null) {
        return res.status(400).json({ error: 'session not found'})
    }
    //console.log(session);

    const pass = req.body.pass;
    if (pass == null) {
        return res.status(400).json({ error: 'pass not found in body'})
    }

    const decryptedPass = session.decryptMessage(pass)


        /*const adress = getAddress(session.id)
    if (session == null) {
        return res.status(400).json({ error: 'session address not found'})
    }
    console.log(adress)*/

    if (decryptedPass == airWebToken) {
        return res.json({
            adressMap: Object.fromEntries(getAddressMap())
        })
    }
    return res.status(401).json({ error: "invalid pass" });
};