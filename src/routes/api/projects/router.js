const router = require('express').Router();

const { requireAdmin } = require('../../middleware/auth.js');

router.get('/', require('./projects.js'));
router.post('/edit', require('./project_edit.js'));   // view counter, not the editor
router.post('/update', requireAdmin, require('./projects_update.js'));

module.exports = router;