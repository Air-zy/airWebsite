// TODO
let projects = {};
let lastairsiteGet = 0;
module.exports = (req, res) => {
  const now = Date.now();
  if (now > lastairsiteGet) {
    console.log("refetching projects")
    lastairsiteGet = now + 30 * 1000;
    //projects = await firedbAirsiteGet();
  }
  res.status(200).send(projects)
};
