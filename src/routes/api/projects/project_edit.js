const { getIP, getProjects, setProjects } = require('../../ip_utils.js');
const { getAddress } = require('../../classes/addressRegistry/addressManager.js');
const { firedbAirsiteSave } = require('../../../firebase/firebasedb.js');

let lastUpdate = 0;
async function attemptSaveProjectsList(projects) {
  setProjects(projects);
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
    
    const ipDecimal = getIP(req)
    const addr = getAddress(ipDecimal);
    if (!addr) return res.status(400).send("Bad request. IP is not recognized.");
    addr.captcha |= 1 << 2;

    attemptedViewsToday[ipDecimal] ??= {}
    
    try {
      const type = req.body.type
      const value = req.body.value
      if (type == "view") {
        if (attemptedViewsToday[ipDecimal][value]) { // already sent a view today
          return;
        }
        let projects = getProjects();
        let selectedProject = projects[value]
        selectedProject.stats.views += 1
        attemptedViewsToday[ipDecimal][value] = true
        attemptSaveProjectsList(projects)
      }
    } catch (error) {
      console.error('Error project stats:', error);
      res.status(500).send('Failed to edit project stats');
    }
  } 
};
