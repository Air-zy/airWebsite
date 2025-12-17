
const { fetchData } = require('../../../firebase/firebasedb2.js')

module.exports = async (req, res) => {
  try {
    const data = await fetchData();
    res.json({ data: data.base64 });
  } catch (err) {
    console.error('[anime3 get api] error:', err);
    res.status(500).json({ error: 'anime3 load error' });
  }
};
