const ipUtils = require('./ip_utils.js');
const { ipv4ToDecimal, isValidIPv4, bitset, getIP } = ipUtils;


module.exports = (req, res) => {
  const ipAddress = getIP(req)
  const IPv4 = ipv4ToDecimal(ipAddress);
  
  const behaviorData = req.body;
  const { sessionDuration } = behaviorData;
  
  let updatedCurrentAdresses = ipUtils.updatedCurrentAdresses;
  if (updatedCurrentAdresses == undefined) {
    return res.json({ valid: false, message: "server data still loading..." });
  }

  console.log(updatedCurrentAdresses, IPv4)
  console.log(sessionDuration > 500, updatedCurrentAdresses[IPv4])
  if (sessionDuration > 500 && updatedCurrentAdresses[IPv4]) {
    
    if (updatedCurrentAdresses[IPv4]) {
      const currentIPV4 = updatedCurrentAdresses[IPv4]
      let currentCaptcha = 0
      if (currentIPV4["captcha"] !== undefined) {
        currentCaptcha = currentIPV4["captcha"];
      }
      updatedCurrentAdresses[IPv4] = {
        ...updatedCurrentAdresses[IPv4],
        captcha: bitset(currentCaptcha, 2),
      };
    }
    
    res.json({ valid: true, message: process.env.email, cord: process.env.discord, cordN: process.env.discordName, loc: process.env.location });
  } else {
    res.json({ valid: false, message: "failed human validation." });
  }
}