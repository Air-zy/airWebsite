const { clean, saveProjects } = require('./store.js');

// auth lives on the route declaration, see projects/router.js
module.exports = async (req, res) => {
  let projects;
  // the error handler hides 400 messages, the editor wants to show which project is wrong
  try {
    projects = clean(req.body);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
  const saved = await saveProjects(projects);
  res.json({ success: true, data: saved });
};
