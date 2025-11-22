const envDecrypt = require('../FallbackEncryption/envDecrypt.js')
const rowaDBPass = envDecrypt(process.env.airKey, process.env.rowaDBPass)

module.exports = (req, res, next) => {
  const auth = req.headers['authorization']
  if (auth !== rowaDBPass) {
    return res.status(401).send('Unauthorized: bad token')
  }
  next()
}