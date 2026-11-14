const router = require('express').Router();

const { requireAdmin } = require('../../middleware/auth.js');
const { peopleList } = require('../../../config/site.js');
const { getPeople, savePeople, clean } = require('./store.js');

// the home page section, drawn. sent only when someone opens it, so the names are not in the page, and noindex
// keeps this answer out of search results
router.get('/', async (req, res) => {
  res.set('X-Robots-Tag', 'noindex');
  res.json({ html: peopleList(await getPeople()) });
});

// peopleEdit.html loads and saves { groups, people } as data. owner only, the page itself is open like projectsEdit
router.get('/list', requireAdmin, async (req, res) => {
  res.json(await getPeople());
});

router.post('/update', requireAdmin, async (req, res) => {
  let data;
  // the error handler hides 400 messages, the editor wants to show which friend is wrong
  try {
    data = clean(req.body);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
  await savePeople(data);
  res.json({ ok: true, ...data });
});

module.exports = router;
