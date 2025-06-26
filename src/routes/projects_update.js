const { firedbAirsiteSave } = require('../firebasedb.js');
const envDecrypt = require('./envDecrypt.js')

const EXPECTED_TOKEN = envDecrypt(process.env.airKey, process.env.airWebToken)

module.exports = (req, res) => {
  if (req.body == undefined) {
    return res.status(400).json({ error: 'Request body is missing'})
  }
  
  const authHeader = req.headers.authorization;
  if (!EXPECTED_TOKEN) {
    console.warn('process.env.airWebToken is not set');
    return res.status(500).json({ error: 'Server misconfiguration: missing airWebToken' });
  } else {
    if (!authHeader) {
      return res.status(401).json({ error: 'Unauthorized: missing token' });
    }
    if (authHeader.trim() !== EXPECTED_TOKEN) {
      return res.status(401).json({ error: 'Unauthorized: invalid token' });
    }
  }
  
  firedbAirsiteSave(req.body)
  return res.status(200).json({ success: true, data: result });
}