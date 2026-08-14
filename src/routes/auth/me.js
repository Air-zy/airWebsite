const { getAccountByUID } = require('../../modules/account/accountsManager.js');

// a***@gmail.com, enough to recognise your own address without publishing it
function maskEmail(email) {
  if (typeof email !== 'string' || !email.includes('@')) return null;
  const [local, domain] = email.split('@');
  return local.slice(0, 1) + '***@' + domain;
}

module.exports = async (req, res) => {
  const acc = await getAccountByUID(req.user.uid);
  if (!acc) return res.status(401).json({ error: 'not-authenticated' }); // deleted account

  return res.json({
    uid: acc.uid,
    name: acc.name,
    createdAt: acc.createdAt,
    email: maskEmail(acc.email)
  });
};
