const { getLastOnline } = require('../../../modules/myStatus/myStatus.js');

module.exports = async (req, res) => {
  try {
    const lastOnline = await getLastOnline();
    res.status(200).json(lastOnline);
  } catch (err) {
    console.warn('[Status Tracker] Error', err);
    res.status(500).send('Error fetching last online');
  }
};