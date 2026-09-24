const { firedbAirsiteGet } = require('../firebase/firebasedb.js');

let projects = null;

(async () => {
  projects = await firedbAirsiteGet();
  console.log("[FIRE DB] all init data loaded")
})();

function getIP(req) {
  const ipList = req.headers['x-forwarded-for']
  if (ipList) {
    const ips = ipList.split(',');
    const firstIp = ips[0].trim();
    return firstIp;
  }

  return req.connection?.remoteAddress ||
         req.socket?.remoteAddress ||
         req.connection?.socket?.remoteAddress ||
         null;
}

function getProjects() {
  return projects;
}

function setProjects(newProjects) {
  projects = newProjects;
}

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
  getProjects,
  setProjects,
  referLookup,
};
