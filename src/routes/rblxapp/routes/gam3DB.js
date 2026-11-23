const router = require('express').Router();

const envDecrypt = require('../../../FallbackEncryption/envDecrypt.js');
const requireToken = require('../../middleware/requireToken.js');
const { commitRblxData, getRblxDataDecompressed } = require('../robloxstuff.js');

const airWebToken = envDecrypt(process.env.airKey, process.env.airWebToken);

router.get('/', async (req, res) => {
  const data = await getRblxDataDecompressed();
  res.json(data);
});

router.post('/', requireToken(airWebToken), (req, res) => {
  // not awaited, the game gets its answer straight away. a body that won't gzip would otherwise stop node
  commitRblxData(req.body).catch(err => console.error('[gam3DB] commit failed:', err.message));
  res.json({ message: 'Data received successfully' });
});

module.exports = router;
