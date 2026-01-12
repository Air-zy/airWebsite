const { createSession } = require('./classes/sessionRegistry/sessionManager.js');

module.exports = (req, res) => {
  res.json(
    createSession(clientUID).onlyPublic()
  );
};