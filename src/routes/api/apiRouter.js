const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();

function silent429(req, res /*, next */) {
  res.status(429).end();
}

router.use('/rowa', require('./rowa2/router.js'));
router.use('/projects', require('./projects/router.js'));
router.use('/status', require('./status/router.js'));

router.post('/rowadb/fights',      require('./rowa2/rowa_fights.js')       );


router.get('/anime2/data',         require('./anime2/data.js')             );
router.get('/anime3/data',         require('./anime3/data.js')             );
router.get('/anime3/coords',       require('./anime3/coords.js')           );

router.get('/rblx',                require('./api_rblx.js')                );
router.get('/logs',                require('./api_logs.js')                );
router.get('/headers',             require('./api_headers.js')             );
router.get('/cluster-units',       require('./api_clusterUnits.js')        );
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
