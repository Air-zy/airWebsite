const { getPlrData } = require('../../rblxapp/rowautils.js');

module.exports = async (req, res) => {
  try {
    res.json(await getPlrData(req.params.userid));
  } catch (err) {
    res.status(500).json({ error: 'plr data request err' });
  }
};
