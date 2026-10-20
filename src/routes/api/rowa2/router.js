const router = require('express').Router();

router.get('/all', require('./allPlrData.js'));
// above /:userid, or "cards" would be read as a user id
router.get('/cards', require('./cards.js'));
router.get('/:userid', require('./plrData.js'));

module.exports = router;