const express = require('express');
const rateLimit = require('express-rate-limit');

const router = express.Router();

const loginHandler = require('./login.js');
const registerHandler = require('./register.js');
const accUIDHandler = require('./accUID.js');

function silent429(req, res /*, next */) {
  res.status(429).end();
}

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: silent429,
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: silent429,
});

const accountLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  handler: silent429,
});

router.post('/login', loginLimiter, loginHandler);
router.post('/register', registerLimiter, registerHandler);
router.get('/account/:uid', accountLimiter, accUIDHandler);

module.exports = router;
