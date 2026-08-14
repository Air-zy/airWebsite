const router = require('express').Router();

router.get('/all', require('./allPlrData.js'));
router.get('/:userid', require('./plrData.js'));

module.exports = router;