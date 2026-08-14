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
  commitRblxData(req.body);
  res.json({ message: 'Data received successfully' });
});

module.exports = router;
