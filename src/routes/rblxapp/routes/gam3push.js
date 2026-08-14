const rowagit = require('./rowagit.js')

// auth lives on the route declaration, see rblxapp/router.js
module.exports = async (req, res) => {
  try {
    const { fpath, content, commitMsg } = req.body;
    rowagit.game3git(fpath, content, commitMsg);  
    return res.status(200).json({ message: 'Success' });
  } catch (err) {
    console.log(err)
    res.status(500).json({ error: err.toString() });
  }
};
