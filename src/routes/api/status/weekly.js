const { getWeeklyStatus } = require('../../../modules/myStatus/myStatus.js');

module.exports = async (req, res) => {
  try {
    const weeklyStatus = await getWeeklyStatus();
    res.status(200).json(weeklyStatus);
  } catch (err) {
    console.warn('[Status Tracker] Error', err);
    res.status(500).send('Error fetching weekly status');
  }
};