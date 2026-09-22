const router = require('express').Router();
const window = require('./window.js');

router.get('/lastOnline', require('./lastOnline.js'));
router.get('/weekly', window(7));
router.get('/yearly', window(365));
router.get('/analyze', require('./analyze.js'));

module.exports = router;
