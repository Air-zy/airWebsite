const { firedbAirsiteGet } = require('../firebasedb.js');
let projects = {};
let lastairsiteGet = 0;

(async () => {
  projects = await firedbAirsiteGet();
})();

module.exports = async (req, res) => {
  const now = Date.now();
  if (now > lastairsiteGet) {
    console.log("refetching projects")
    lastairsiteGet = now + 30 * 1000;
    projects = await firedbAirsiteGet();
  }
  res.status(200).send(projects)
};
