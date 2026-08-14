const rateLimit = require('express-rate-limit');
const { requireAuth, clearAuthCookie } = require('../middleware/auth.js');

const router = require('express').Router();

const loginHandler = require('./login.js');
const registerHandler = require('./register.js');
const accUIDHandler = require('./accUID.js');

// auth routes need a readable body so the ui can say why, unlike the silent429 used elsewhere
function json429(req, res) {
  res.status(429).json({ error: 'too-many-attempts' });
}

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: json429,
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: json429,
});

const accountLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  handler: json429,
});

const resetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  handler: json429,
});

// abuse control only, brute forcing a 256 bit hmac is not a threat model
const confirmLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: json429,
});

router.post('/login', loginLimiter, loginHandler);
router.post('/register', registerLimiter, registerHandler);
router.get('/account/:uid', accountLimiter, accUIDHandler);

router.post('/reset/request', resetLimiter, require('./resetRequest.js'));
router.post('/reset/confirm', confirmLimiter, require('./resetConfirm.js'));

router.get('/me', accountLimiter, requireAuth, require('./me.js'));
router.post('/password', accountLimiter, requireAuth, require('./changePassword.js'));

// global limiter covers this one, no reason for its own
router.post('/logout', (req, res) => {
  clearAuthCookie(req, res);
  res.json({ ok: true });
});

module.exports = router;
