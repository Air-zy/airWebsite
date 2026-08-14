const router = require('express').Router();

const envDecrypt = require('../../FallbackEncryption/envDecrypt.js');
const requireToken = require('../middleware/requireToken.js');

const airWebToken2 = envDecrypt(process.env.airKey, process.env.airWebToken2);

router.get('/rowa',  (req, res) => res.redirect('/ROWA/game.html'));
router.get('/rowa2', (req, res) => res.redirect('/ROWA/rowa2.html'));
router.get('/rowa/:userid', require('./routes/rowauser.js'));

router.post('/gam3push', requireToken(airWebToken2), require('./routes/gam3push.js'));

module.exports = router;
