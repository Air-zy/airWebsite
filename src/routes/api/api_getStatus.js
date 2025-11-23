const { firedbActivityGet } = require('../../firebasedb.js');

let lastCall = 0;
let cache = null;

module.exports = async (req, res) => {
  const now = Date.now();

  if (now - lastCall < 10000 && cache) {
    return res.status(200).send(cache);
  }

  const meActivityGet = await firedbActivityGet();
  lastCall = now;
  cache = meActivityGet;
  res.status(200).send(meActivityGet);
};
