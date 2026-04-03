const router = require('express').Router();

router.get('/lastOnline', require('./lastOnline.js'));
router.get('/weekly', require('./weekly.js'));
router.get('/monthly', require('./monthly.js'));
router.get('/analyze', require('./analyze.js'));

module.exports = router;