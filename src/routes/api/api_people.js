// the friends list on the home page. sent only when someone opens that section, so the names are not in the
// page itself, and noindex keeps this answer out of search results. the list lives in src/config/site.js
const site = require('../../config/site.js');

module.exports = (req, res) => {
  res.set('X-Robots-Tag', 'noindex');
  res.json({ html: site.peopleHtml });
};
