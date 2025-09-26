const { getAnimeDataCompressed } = require('../../DATABASE/utilDB.js');

module.exports = async (req, res) => {
  try {
    const blob = await getAnimeDataCompressed();
    if (!blob) {
      return res.status(404).send('No data found');
    }
    res.send(blob);
  } catch (err) {
    console.error('[getAnimeDataCompressed get api] error:', err);
    res.status(500).json({ error: 'Database error' });
  }
};
