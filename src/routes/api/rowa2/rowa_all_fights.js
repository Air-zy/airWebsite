const { getAllFights } = require('../../../DATABASE/rowaDB.js');

module.exports = async (req, res) => {
  try {
    const fights = await getAllFights();

    res.json({ success: true, fights });
  } catch (err) {
    console.error('[fights_get] error:', err);
    res.status(500).json({ error: 'Database error' });
  }
};
