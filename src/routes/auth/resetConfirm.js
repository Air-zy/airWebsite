const { getAccountByUID, setAccountPassword } = require('../../modules/account/accountsManager.js');
const { parseResetUid, readResetToken, setAuthCookie } = require('../middleware/auth.js');

const BAD = ['password-too-short', 'password-too-long', 'password-required'];

module.exports = async (req, res) => {
  const { token, password } = req.body || {};
  if (!token || !password) return res.status(400).json({ error: 'missing-fields' });

  // read the uid out first so we can load the account, the signature is checked after
  const uid = parseResetUid(token);
  const acc = uid ? await getAccountByUID(uid) : null;

  // the accounts current passwordHash is part of the signature, so a token that has
  // already been used no longer verifies. that is the single use guarantee.
  if (!acc || readResetToken(token, acc.passwordHash) !== uid) {
    return res.status(400).json({ error: 'invalid-token' });
  }

  try {
    await setAccountPassword(acc, password);
  } catch (err) {
    if (BAD.includes(err.message)) return res.status(400).json({ error: err.message });
    throw err;
  }

  // resetting logs you in, no reason to bounce them to the login form
  setAuthCookie(req, res, acc.uid);
  return res.json({ ok: true, uid: acc.uid, name: acc.name });
};
