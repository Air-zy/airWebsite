const { firedbAirsiteSave } = require('../../../firebase/firebasedb.js');
const { setProjects } = require('../../ip_utils.js');

// auth lives on the route declaration, see projects/router.js
module.exports = (req, res) => {
  if (req.body == undefined) {
    return res.status(400).json({ error: 'Request body is missing'})
  }

  const data = req.body;
  firedbAirsiteSave(data)
  console.log(data)
  setProjects(data)
  return res.status(200).json({ success: true, data: req.body });
}