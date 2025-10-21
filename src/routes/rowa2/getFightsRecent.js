const { getRecentContributions } = require('../../DATABASE/rowaDB.js');

module.exports = async (req, res) => {
  try {
    let { limit } = req.query;

    // default to 100, max 2000 to prevent huge queries
    limit = limit ? parseInt(limit, 10) : 100;
    const MAX_LIMIT = 2000;
    if (limit > MAX_LIMIT) limit = MAX_LIMIT;

    const contributions = await getRecentContributions(limit);

    // parse raw_snapshot from fights if included
    contributions.forEach(c => {
      if (c.raw_snapshot) {
        try {
          c.raw_snapshot = JSON.parse(c.raw_snapshot);
        } catch {}
      }
    });

    res.json({ success: true, contributions });
  } catch (err) {
    console.error('[fights_getRecent] error:', err);
    res.status(500).json({ error: 'Database error' });
  }
};
