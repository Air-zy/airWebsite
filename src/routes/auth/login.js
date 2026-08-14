const { login } = require('../../modules/account/accountsManager.js');
const { setAuthCookie } = require('../middleware/auth.js');

module.exports = async (req, res) => {
  const { identifier, password } = req.body || {};

  if (!identifier || !password) {
    return res.status(400).json({ error: 'missing-fields' });
  }

  const acc = await login(identifier, password);
  if (!acc) return res.status(401).json({ error: 'invalid-credentials' });

  setAuthCookie(req, res, acc.uid);
  return res.json({ uid: acc.uid, name: acc.name });
};
