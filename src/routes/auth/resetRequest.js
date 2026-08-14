const { getAccountByEmail } = require('../../modules/account/accountsManager.js');
const { makeResetToken } = require('../middleware/auth.js');
const { sendResetMail } = require('../../modules/mail.js');

module.exports = async (req, res) => {
  const email = String((req.body && req.body.email) || '');

  // always the same answer, never confirm whether an address is registered.
  // replying before the lookup makes this constant time by construction, and means
  // a slow or failing mail send cannot 500 the user or leak anything either.
  res.json({ ok: true });

  // this runs after the response, so it must never throw. an unhandled rejection kills the process.
  try {
    if (!email) return;

    const acc = await getAccountByEmail(email);
    if (!acc) return;

    await sendResetMail(acc.email, acc.name, makeResetToken(acc.uid, acc.passwordHash));
  } catch (err) {
    console.error('[reset] request failed', err);
  }
};
