const crypto = require('crypto');

// shared bearer token check, replaces the hand rolled !== compares
// transform is for callers that decrypt the header instead of comparing it raw (nfetch)
module.exports = (expected, transform = v => v) => (req, res, next) => {
  if (!expected) {
    console.warn('[requireToken] no expected token configured for', req.originalUrl);
    return res.status(500).json({ error: 'server misconfigured' });
  }

  const got = req.headers['authorization'];
  if (!got) return res.status(401).json({ error: 'unauthorized' });

  let a, b;
  try {
    a = Buffer.from(transform(got.trim()));
    b = Buffer.from(expected);
  } catch {
    return res.status(401).json({ error: 'unauthorized' });
  }

  // timingSafeEqual throws on length mismatch so check that first
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  next();
};
