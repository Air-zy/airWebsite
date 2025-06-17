const { ipv4ToDecimal, getIPData, bitset, getIP, getProjects } = require('./ip_utils.js');
const { firedbAirsiteSave } = require('../firebasedb.js');

let lastUpdate = 0;
async function attemptSaveProjectsList(projects) {
  const now = Date.now();
  if (now > lastUpdate + 6000) {
    // 1000 ms = 1 second soo 6 second is max update rate limit
    lastUpdate = now;
    firedbAirsiteSave(projects)
  }
}

let attemptedViewsToday = {}
module.exports = (req, res) => {
  if (req && req.body) {
    
    const ipAddress = getIP(req)
    const IPv4 = ipv4ToDecimal(ipAddress);
    let ipData = getIPData(IPv4);

    if (ipData) {
      let currentCaptcha = 0
      if (ipData["captcha"] !== undefined) {
        currentCaptcha = ipData["captcha"];
      }
      ipData.captcha = bitset(currentCaptcha, 2);
    }else {
      return res.status(400).send("Bad request. IP is not recognized.");
    }
    
    if (attemptedViewsToday[IPv4]) {
    }else{
      attemptedViewsToday[IPv4] = {}
    }
    
    try {
      const type = req.body.type
      const value = req.body.value
      if (type == "view") {
        if (attemptedViewsToday[IPv4][value]) { // already sent a view today
          return;
        }
        let projects = getProjects();
        let selectedProject = projects[value]
        selectedProject.stats.views += 1
        attemptedViewsToday[IPv4][value] = true
        attemptSaveProjectsList(projects)
      }
    } catch (error) {
      console.error('Error project stats:', error);
      res.status(500).send('Failed to edit project stats');
    }
  } 
};
