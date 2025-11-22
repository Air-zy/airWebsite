const { getCompressedAnimeMap } = require('../../ip_utils.js');

module.exports = (req, res) => {
  return res.send(getCompressedAnimeMap());
};
