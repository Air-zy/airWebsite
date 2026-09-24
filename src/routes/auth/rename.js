const { renameAccount, INPUT_ERRORS } = require('../../modules/account/accountsManager.js');

module.exports = async (req, res) => {
  try {
    const name = await renameAccount(req.user.uid, req.body?.name);
    return res.json({ name });
  } catch (err) {
    if (err.message === 'username-taken') return res.status(409).json({ error: err.message });
    if (err.message === 'not-authenticated') return res.status(401).json({ error: err.message }); // deleted account
    if (INPUT_ERRORS.includes(err.message)) return res.status(400).json({ error: err.message });
    throw err;
  }
};
