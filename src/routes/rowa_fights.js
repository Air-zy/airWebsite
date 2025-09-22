const { logFight } = require('../DATABASE/mainDB.js');

module.exports = async (req, res) => {
  try {
    const { preVictimId, killers, raw } = req.body;
    if (!preVictimId) {
      return res.status(400).json({ error: 'preVictimId required' });
    }
    const fightId = await logFight(preVictimId, killers, raw);
    res.json({ success: true, fightId });
  } catch (err) {
    console.error('[fights_log] error:', err);
    res.status(500).json({ error: 'Database error' });
  }
};
