const { getIPData, bitset, getIP, referLookup } = require('./ip_utils.js');
const { updateAddress } = require('../classes/addressRegistry/addressManager.js')

module.exports = (req, res) => {
  const ipDecimal = getIP(req)

  let reqUserAgent = req.headers["user-agent"]
  reqUserAgent = reqUserAgent.replace("(KHTML, like Gecko)", "KHTML-lG");
  reqUserAgent = reqUserAgent.replace("Windows NT 10.0; Win64; x64", "Win10x64");
  reqUserAgent = reqUserAgent.replace("AppleWebKit", "AplWK");
  reqUserAgent = reqUserAgent.replace("Mozilla", "Mzila");
  reqUserAgent = reqUserAgent.replace("Safari", "Sfri");
  
  const preUserAgent = req.body.a + ' ' + reqUserAgent
  const referrer = referLookup(ipDecimal, req);
  const userAgent = preUserAgent.slice(0, 1000);
  let ipData = getIPData(ipDecimal);

  console.log("c", ipDecimal)

  if (ipData) {
    let currentCaptcha = 0
    if (ipData["captcha"] !== undefined) {
      currentCaptcha = ipData["captcha"];
    }
    ipData = {
      ...ipData,
      captcha: bitset(currentCaptcha, 1),
    };
  }
  
  updateAddress(ipDecimal, userAgent, referrer, req);
  res.status(200).end();
};