const { commitAnime } = require('../firebasedb.js');

function validatePass(pass, req) {
  return (pass == process.env.animePass)
}

module.exports = (req, res) => {
  const { pass, animeMap } = req.body;
  if (validatePass(pass, req) == true && animeMap) {
    commitAnime(animeMap)
    res.json({ success: true, message: "Data received successfully!" });
  } else {
    if (animeMap) {
      res.status(401).json({ message: 'invalid pass' });
    } else {
      res.status(400).json({ message: 'missing animeMap' });
    }
  }
}