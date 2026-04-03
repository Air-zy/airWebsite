const { getMonthlyStatus } = require('../../../modules/myStatus/myStatus.js');

module.exports = async (req, res) => {
  try {
    const monthlyStatus = await getMonthlyStatus();
    res.status(200).json(monthlyStatus);
  } catch (err) {
    console.warn('[Status Tracker] Error', err);
    res.status(500).send('Error fetching monthly status');
  }
};