const { coordsAsBase64, coordsAsBase64_2 } = require('../../../firebase/firebasedb2.js')

module.exports = async (req, res) => {
  try {
    const useAlt = req.query.v === '2';

    const b64data = useAlt
      ? await coordsAsBase64_2()
      : await coordsAsBase64();


    res.json({ data: b64data });
  } catch (err) {
    console.error('[anime3 get api] error:', err);
    res.status(500).json({ error: 'anime3 load error' });
  }
};
