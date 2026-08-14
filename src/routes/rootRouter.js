const router = require('express').Router();

const envDecrypt = require('../FallbackEncryption/envDecrypt.js');
const requireToken = require('./middleware/requireToken.js');
const makeWebhook = require('./webhooks/webhook.js');

const whookPass = envDecrypt(process.env.airKey, process.env.whookPass);
const clusterAcolyteToken = process.env.airClusterAcolyteToken;

router.get('/info',        require('./info.js')        );
router.get('/cookies',     require('./cookies.js')     );

router.get('/r',           require('./r.js')           ); // request token

router.post('/webhook',    requireToken(whookPass), makeWebhook(process.env.dwebhook)    );
router.post('/webhook2',   requireToken(whookPass), makeWebhook(process.env.wn_dwebhook) );

router.post('/c',          require('./c.js')           );
router.post('/validate-me', require('./validate_me.js') );

router.post('/dashboard',  require('./dashboard.js')   );

// nfetch decrypts the header instead of comparing it raw
router.post('/nfetch',
  requireToken(clusterAcolyteToken, h => envDecrypt(process.env.publicClusterKey, h)),
  require('./nfetch.js')
);

module.exports = router;
