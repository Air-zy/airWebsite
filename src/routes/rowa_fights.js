const { logFight } = require('../DATABASE/mainDB.js')

module.exports = async (req, res) => {
  try {
    const { victimId, killers, raw } = req.body
    if (!victimId) {
      return res.status(400).json({ error: 'victimId required' })
    }

    const fightId = await logFight(victimId, killers, raw)

    res.json({ success: true, fightId })
  } catch (err) {
    console.error('[fights_log] error:', err)
    res.status(500).json({ error: 'Database error' })
  }
}
