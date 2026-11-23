const { getIP, referLookup } = require('./ip_utils.js');
const { getAddress, updateAddress } = require('./classes/addressRegistry/addressManager.js')

module.exports = (req, res) => {
  const ipDecimal = getIP(req)

  let reqUserAgent = req.headers["user-agent"] || ''
  reqUserAgent = reqUserAgent.replace("(KHTML, like Gecko)", "KHTML-lG");
  reqUserAgent = reqUserAgent.replace("Windows NT 10.0; Win64; x64", "Win10x64");
  reqUserAgent = reqUserAgent.replace("AppleWebKit", "AplWK");
  reqUserAgent = reqUserAgent.replace("Mozilla", "Mzila");
  reqUserAgent = reqUserAgent.replace("Safari", "Sfri");
  
  const preUserAgent = req.body?.a + ' ' + reqUserAgent // express 5 leaves body undefined when none came
  const referrer = referLookup(ipDecimal, req);
  const userAgent = preUserAgent.slice(0, 1000);

  console.log("c", ipDecimal)

  // bit 1, this ip ran the page js. set on the stored address so updateAddress saves it
  const addr = getAddress(ipDecimal);
  if (addr) addr.captcha |= 1 << 1;

  // not awaited, so it needs its own catch. a check-host outage would be an unhandled rejection, which stops node
  updateAddress(ipDecimal, userAgent, referrer, req).catch(err => console.error('[c] address update failed:', err.message));
  res.status(200).end();
};