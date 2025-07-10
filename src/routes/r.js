const { getIP } = require('./ip_utils.js');
const { createSession } = require('../sessions');

module.exports = (req, res) => {
  const clientUID = getIP(req)
  const t = createSession(clientUID);
  res.json({ t });
};