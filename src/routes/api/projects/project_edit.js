const { getIP } = require('../../ip_utils.js');
const { getAddress } = require('../../classes/addressRegistry/addressManager.js');
const { countView } = require('./store.js');

// a click on a project card, { type: 'view', value: key }. one view per address per project per day, the set starts
// over when the date changes
let today = '';
let seen = new Set();

module.exports = async (req, res) => {
  const ip = getIP(req);
  const addr = getAddress(ip);
  if (!addr) return res.status(400).send("Bad request. IP is not recognized.");
  addr.captcha |= 1 << 2;

  const { type, value: key } = req.body ?? {};
  if (type !== 'view' || typeof key !== 'string') return res.sendStatus(400);

  const day = new Date().toISOString().slice(0, 10);
  if (day !== today) {
    today = day;
    seen = new Set();
  }
  const id = ip + ' ' + key;
  if (seen.has(id)) return res.sendStatus(204);

  // marked before the wait, so a double click counts once. a project that isn't there, or a failed write, gets
  // another try
  seen.add(id);
  let counted = false;
  try {
    counted = await countView(key);
  } finally {
    if (!counted) seen.delete(id);
  }
  res.sendStatus(counted ? 204 : 404);
};
