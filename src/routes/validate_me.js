const { ipv4ToDecimal, getIPData, bitset, getIP } = require('./ip_utils.js');
const envDecrypt = require('../envDecrypt.js')

const trustedDataToSend = {
  valid: true,
  message: envDecrypt(process.env.airKey, process.env.email),
  cord: envDecrypt(process.env.airKey, process.env.discord),
  cordN: envDecrypt(process.env.airKey, process.env.discordName),
  loc: envDecrypt(process.env.airKey, process.env.location)
}

module.exports = (req, res) => {
  const ipAddress = getIP(req)
  const IPv4 = ipv4ToDecimal(ipAddress);
  
  const behaviorData = req.body;
  const { sessionDuration } = behaviorData;
  
  let ipData = getIPData(IPv4);
  if (sessionDuration > 500 && ipData) {
    
    if (ipData) {
      let currentCaptcha = 0
      if (ipData["captcha"] !== undefined) {
        currentCaptcha = ipData["captcha"];
      }
      ipData.captcha = bitset(currentCaptcha, 2);
    }
    
    res.json(trustedDataToSend);
  } else {
    res.json({ valid: false, message: "failed human validation." });
  }
}