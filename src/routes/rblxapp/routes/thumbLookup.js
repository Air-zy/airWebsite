const { getThumb } = require('../rowautils.js');

// the open cloud key cannot go to the browser, so the headshot has to come through here
module.exports = async (req, res) => {
  const uid = Number(req.params.userId);
  if (!Number.isInteger(uid) || uid <= 0) {
    return res.status(400).json({ error: 'bad id' });
  }

  const imageUri = await getThumb(uid);
  if (!imageUri) return res.status(404).json({ error: 'no thumbnail' });

  res.json({ imageUri });
};
