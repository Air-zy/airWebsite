const { getIP } = require('./ip_utils.js');
const { createSession } = require('../sessionRegistry/sessionManager.js');

module.exports = (req, res) => {
  const clientUID = getIP(req)
  const t = createSession(clientUID);
  res.json({ t });
};