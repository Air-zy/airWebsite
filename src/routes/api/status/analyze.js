const { getAnalysis } = require('../../../modules/myStatus/myStatus.js');
module.exports = async (req, res) => {
  try {
    res.status(200).json(await getAnalysis());
  } catch (err) {
    console.warn('[Status Tracker] Error', err);
    res.status(500).send('Error analyzing status');
  }
};
