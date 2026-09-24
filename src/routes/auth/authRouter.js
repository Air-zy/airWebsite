const { limiter } = require('../middleware/ratelimit.js');
const { requireAuth, clearAuthCookie } = require('../middleware/auth.js');

const router = require('express').Router();

const loginHandler = require('./login.js');
const registerHandler = require('./register.js');
const accUIDHandler = require('./accUID.js');
const google = require('./google.js');

// auth routes need a readable body so the ui can say why, unlike the silent429 used elsewhere
function json429(req, res) {
  res.status(429).json({ error: 'too-many-attempts' });
}

const loginLimiter    = limiter({ windowMs: 15 * 60 * 1000, max: 5,  handler: json429 });
const registerLimiter = limiter({ windowMs: 60 * 60 * 1000, max: 10, handler: json429 });
const accountLimiter  = limiter({ windowMs: 10 * 60 * 1000, max: 60, handler: json429 });

router.post('/login', loginLimiter, loginHandler);
router.post('/register', registerLimiter, registerHandler);
router.get('/account/:uid', accountLimiter, accUIDHandler);

// page navigations, so these answer with redirects not json. the callback costs a request to google
router.get('/google', accountLimiter, google.start);
router.get('/google/callback', accountLimiter, google.callback);

router.get('/me', accountLimiter, requireAuth, require('./me.js'));
router.post('/password', accountLimiter, requireAuth, require('./changePassword.js'));
router.post('/username', accountLimiter, requireAuth, require('./rename.js'));

// global limiter covers this one, no reason for its own
router.post('/logout', (req, res) => {
  clearAuthCookie(req, res);
  res.json({ ok: true });
});

module.exports = router;
