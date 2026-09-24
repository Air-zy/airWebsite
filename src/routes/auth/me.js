const { getAccountByUID } = require('../../modules/account/accountsManager.js');
const { ADMIN_UID } = require('../middleware/auth.js');

module.exports = async (req, res) => {
  const acc = await getAccountByUID(req.user.uid);
  if (!acc) return res.status(401).json({ error: 'not-authenticated' }); // deleted account

  return res.json({
    uid: acc.uid,
    name: acc.name,
    createdAt: acc.createdAt,
    hasPassword: !!acc.passwordHash, // google accounts have none, profile hides change password
    admin: acc.uid === ADMIN_UID   // ui affordance only, the server still gates every admin route
  });
};
