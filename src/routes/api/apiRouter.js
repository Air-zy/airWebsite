const { limiter } = require('../middleware/ratelimit.js');
const envDecrypt = require('../../FallbackEncryption/envDecrypt.js');
const requireToken = require('../middleware/requireToken.js');
const { requireAdmin } = require('../middleware/auth.js');
const { clusterUrls } = require('../../heartSystem/heart.js');
const router = require('express').Router();

const airWebToken = envDecrypt(process.env.airKey, process.env.airWebToken);

router.use('/rowa', require('./rowa2/router.js'));
router.use('/projects', require('./projects/router.js'));
router.use('/status', require('./status/router.js'));
router.use('/notes', require('./notes.js'));
router.use('/gam3DB', require('../rblxapp/routes/gam3DB.js'));

router.get('/roblox-user/:userId', require('../rblxapp/routes/userlookup.js'));
router.post('/roblox-users', require('../rblxapp/routes/usersLookup.js'));
router.get('/roblox-thumb/:userId', require('../rblxapp/routes/thumbLookup.js'));

router.get('/anime3/data',         require('./anime3/data.js')             );
router.get('/anime3/coords',       require('./anime3/coords.js')           );

router.get('/rblx',                require('./api_rblx.js')                );
// visitor ips and user agents, owner only
router.get('/logs',                requireAdmin, require('./api_logs.js') );
router.get('/headers',             require('./api_headers.js')             );
// the same peer list the heartbeat pings
router.get('/cluster-units',       requireToken(airWebToken), async (req, res) => res.json(await clusterUrls()) );
router.get('/deepTalents',         require('./api_deepwokenTalents.js')   );

router.post('/imggen', limiter({ windowMs: 6 * 1000, max: 1 }), require('./api_imggen.js'));
module.exports = router;
