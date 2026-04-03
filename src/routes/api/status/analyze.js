const { getStatusLog } = require('../../../modules/myStatus/myStatus.js');
const forecast  = require('../../../modules/myStatus/forecastStatus.js');
module.exports = async (req, res) => {
  try {
    const multi = await getStatusLog();
    const result = forecast.analyze(multi);
    console.log(result);
    res.status(200).json(result);
  } catch (err) {
    console.warn('[Status Tracker] Error', err);
    res.status(500).send('Error analyzing status');
  }
};