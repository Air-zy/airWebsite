const { getContributionsByFightId } = require('../../DATABASE/rowaDB.js');

module.exports = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ error: 'Fight ID required' });

    const fight = await getContributionsByFightId(id);

    if (!fight) return res.status(404).json({ error: 'Fight not found' });

    if (fight.raw_snapshot) {
      try {
        fight.raw_snapshot = JSON.parse(fight.raw_snapshot);
      } catch {
      }
    }

    res.json({ success: true, fight });
  } catch (err) {
    console.error('[fights_getById] error:', err);
    res.status(500).json({ error: 'Database error' });
  }
};
