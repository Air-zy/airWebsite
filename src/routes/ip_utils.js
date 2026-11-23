// the visitor, as the last proxy saw it (trust proxy 1 in server.js). the first X-Forwarded-For entry is whatever the
// client wrote there, cloudflare appends to it rather than replacing it
const getIP = req => req.ip ?? null;

let lookupTBL = {};
function referLookup(ip, req) {
  const referer = req.get('referer'); // or req.headers.referer

  // If referer exists, return it (or process it)
  if (referer) {
    lookupTBL[ip] = referer;
    return referer;
  }

  // If no referer but we’ve seen this IP before
  if (lookupTBL[ip]) {
    return lookupTBL[ip];
  }
}

module.exports = {
  getIP,
  referLookup,
};
