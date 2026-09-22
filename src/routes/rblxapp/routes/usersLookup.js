const { fetchUsersByIds } = require('../rblxutils.js');

const MAX_IDS = 1000;

// batch id -> username, 200 per upstream call plus a process wide cache
module.exports = async (req, res) => {
  const ids = (req.body && req.body.ids) || [];
  if (!Array.isArray(ids)) return res.status(400).json({ error: 'ids must be an array' });
  if (ids.length > MAX_IDS) return res.status(400).json({ error: 'too many ids' });

  const users = await fetchUsersByIds(ids);

  const out = {};
  for (const [uid, user] of Object.entries(users)) {
    if (user && user.name) out[uid] = user.name;
  }

  res.json(out);
};
