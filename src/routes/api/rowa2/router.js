const router = require('express').Router();

router.get('/fights/recent', require('./getFightsRecent.js'));
router.get('/fights/:id', require('./getFightById.js'));
router.get('/fights', require('./rowa_all_fights.js'));
router.get('/all', require('./allPlrData.js'));
router.get('/:userid', require('./plrData.js'));

module.exports = router;