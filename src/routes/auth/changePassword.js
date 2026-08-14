const { getAccountByUID, setAccountPassword } = require('../../modules/account/accountsManager.js');

const BAD = ['password-too-short', 'password-too-long', 'password-required'];

module.exports = async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'missing-fields' });
  }

  const acc = await getAccountByUID(req.user.uid);
  // current password required, so a stolen cookie alone cant lock the owner out
  if (!acc || !(await acc.verifyPassword(currentPassword))) {
    return res.status(401).json({ error: 'invalid-credentials' });
  }

  try {
    await setAccountPassword(acc, newPassword);
  } catch (err) {
    if (BAD.includes(err.message)) return res.status(400).json({ error: err.message });
    throw err;
  }

  // ponytail: cannot log out other devices, sessions are stateless.
  // upgrade path is the tokenVersion note in middleware/auth.js
  return res.json({ ok: true });
};
