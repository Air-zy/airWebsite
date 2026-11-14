const { getProjects } = require('./store.js');

module.exports = async (req, res) => {
  res.json(await getProjects());
};
