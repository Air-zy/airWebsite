const rateLimit = require('express-rate-limit');
const { silent429 } = require('../middleware/ratelimit.js');
const envDecrypt = require('../../FallbackEncryption/envDecrypt.js');
const requireToken = require('../middleware/requireToken.js');
const { requireAdmin } = require('../middleware/auth.js');
const router = require('express').Router();

const airWebToken = envDecrypt(process.env.airKey, process.env.airWebToken);

router.use('/rowa', require('./rowa2/router.js'));
router.use('/projects', require('./projects/router.js'));
router.use('/status', require('./status/router.js'));
router.use('/gam3DB', require('../rblxapp/routes/gam3DB.js'));

router.get('/roblox-user/:userId', require('../rblxapp/routes/userlookup.js'));

router.get('/anime2/data',         require('./anime2/data.js')             );
router.get('/anime3/data',         require('./anime3/data.js')             );
router.get('/anime3/coords',       require('./anime3/coords.js')           );

router.get('/rblx',                require('./api_rblx.js')                );
// visitor ips and user agents, owner only
router.get('/logs',                requireAdmin, require('./api_logs.js') );
router.get('/headers',             require('./api_headers.js')             );
router.get('/cluster-units',       requireToken(airWebToken), require('./api_clusterUnits.js') );
router.get('/deepTalents',         require('./api_deepwokenTalents.js')   );

router.post('/get-anime',          require('./anime/get_anime.js')         );
router.post('/commit-anime',       require('./anime/commit_anime.js')      );

const imgLimiter = rateLimit({
  windowMs: 6 * 1000,
  max: 1,
  standardHeaders: true,
  legacyHeaders: false,
  handler: silent429,
});

router.post('/imggen', imgLimiter, require('./api_imggen.js'));
module.exports = router;
