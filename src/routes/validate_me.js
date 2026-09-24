const { getIP } = require('./ip_utils.js');
const { getAddress } = require('./classes/addressRegistry/addressManager.js');
const envDecrypt = require('../FallbackEncryption/envDecrypt.js')

const trustedDataToSend = {
  valid: true,
  message: envDecrypt(process.env.airKey, process.env.email),
  cord: envDecrypt(process.env.airKey, process.env.discord),
  cordN: envDecrypt(process.env.airKey, process.env.discordName),
  loc: envDecrypt(process.env.airKey, process.env.location)
}

module.exports = (req, res) => {
  const ipDecimal = getIP(req)
  const behaviorData = req.body;

  const { sessionDuration } = behaviorData;
  
  const addr = getAddress(ipDecimal);
  if (sessionDuration > 500 && addr) {
    // bit 2, passed the human check. goes out with the next address save
    addr.captcha |= 1 << 2;
    res.json(trustedDataToSend);
  } else {
    res.json({ valid: false, message: "failed human validation." });
  }
}