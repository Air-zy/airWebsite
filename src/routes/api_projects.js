const { firedbAirsiteGet } = require('../firebasedb.js');
const { getProjects } = require('./ip_utils.js');


let lastairsiteGet = 0;
module.exports = async (req, res) => {
  const now = Date.now();
  let projects = getProjects();
  if (now > lastairsiteGet) {
    console.log("refetching projects")
    lastairsiteGet = now + 30 * 1000;
    projects = await firedbAirsiteGet();
  }
  res.status(200).send(projects)
};
