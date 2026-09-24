const rateLimit = require('express-rate-limit');

function silent429(req, res /*, next */) {
  res.status(429).end();
}

// every limiter on the site shares these, callers pass the window, the cap and anything else they change
const limiter = opts => rateLimit({
  standardHeaders: true,
  legacyHeaders: false,
  handler: silent429,
  ...opts,
});

// 30 reqs per 30s per ip
const clientLimiter = limiter({ windowMs: 30 * 1000, max: 30 });

module.exports = { clientLimiter, limiter };
