const { readChunks } = require('../../../firebase/firebasedb2.js')

module.exports = async (req, res) => {
  try {
    const b64data = await readChunks(req.query.v === '2' ? 'animeCoords2' : 'animeCoords');
    res.json({ data: b64data });
  } catch (err) {
    console.error('[anime3 get api] error:', err);
    res.status(500).json({ error: 'anime3 load error' });
  }
};
