const rateLimit = require('express-rate-limit');

function silent429(req, res /*, next */) {
  res.status(429).end();
}

const clientLimiter = rateLimit({
  windowMs: 30 * 1000,  // 1m
  max: 30,              // 30 reqs per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  handler: silent429,
});

module.exports = clientLimiter;