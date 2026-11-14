const router = require('express').Router();

const { requireAdmin } = require('../../middleware/auth.js');
const { getProjects } = require('./store.js');

router.get('/', require('./projects.js'));
router.post('/edit', require('./project_edit.js'));   // view counter, not the editor
router.post('/update', requireAdmin, require('./projects_update.js'));

// read at boot, so the first visitor doesn't wait on firestore
getProjects()
  .then(() => console.log('[FIRE DB] projects loaded'))
  .catch(err => console.error('[FIRE DB] projects:', err.message));

module.exports = router;
