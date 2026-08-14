const router = require('express').Router();

const envDecrypt = require('../../../FallbackEncryption/envDecrypt.js');
const requireToken = require('../../middleware/requireToken.js');

const airWebToken = envDecrypt(process.env.airKey, process.env.airWebToken);

router.get('/', require('./projects.js'));
router.post('/edit', require('./project_edit.js'));
router.post('/update', requireToken(airWebToken), require('./projects_update.js'));

module.exports = router;