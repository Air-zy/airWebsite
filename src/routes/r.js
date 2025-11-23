const { getIP } = require('./ip_utils.js');
const { createSession } = require('../classes/sessionRegistry/sessionManager.js');

module.exports = (req, res) => {
  const clientUID = getIP(req)
  res.json(
    createSession(clientUID)
  );
};