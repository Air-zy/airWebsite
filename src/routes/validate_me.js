const { ipv4ToDecimal, getIPData, isValidIPv4, bitset, getIP } = require('./ip_utils.js');


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
    
    res.json({ valid: true, message: process.env.email, cord: process.env.discord, cordN: process.env.discordName, loc: process.env.location });
  } else {
    res.json({ valid: false, message: "failed human validation." });
  }
}