const rowagit = require('../../../modules/rowagit.js')
const envDecrypt = require('../../../envDecrypt.js')
const airWebToken2 = envDecrypt(process.env.airKey, process.env.airWebToken2)

module.exports = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || authHeader !== airWebToken2) {
      return res.sendStatus(401);
    }
    
    const { fpath, content, commitMsg } = req.body;
    rowagit.game3git(fpath, content, commitMsg);  
    return res.status(200).json({ message: 'Success' });
  } catch (err) {
    console.log(err)
    res.status(500).json({ error: err.toString() });
  }
};
