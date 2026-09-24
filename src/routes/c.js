const { getIP, referLookup } = require('./ip_utils.js');
const { getAddress, updateAddress } = require('./classes/addressRegistry/addressManager.js')

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

  console.log("c", ipDecimal)

  // bit 1, this ip ran the page js. set on the stored address so updateAddress saves it
  const addr = getAddress(ipDecimal);
  if (addr) addr.captcha |= 1 << 1;

  updateAddress(ipDecimal, userAgent, referrer, req);
  res.status(200).end();
};