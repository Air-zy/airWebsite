const { getRollingStatus } = require('../../../modules/myStatus/myStatus.js');

// one handler per window length, see router.js
module.exports = days => async (req, res) => {
  try {
    res.status(200).json(await getRollingStatus(days));
  } catch (err) {
    console.warn('[Status Tracker] Error', err);
    res.status(500).send('Error fetching status');
  }
};
