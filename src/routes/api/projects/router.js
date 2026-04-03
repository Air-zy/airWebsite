const router = require('express').Router();

router.get('/', require('./projects.js'));
router.post('/edit', require('./project_edit.js'));
router.post('/update', require('./projects_update.js'));

module.exports = router;