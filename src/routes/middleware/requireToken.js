const crypto = require('crypto');

// shared bearer token check, transform is for callers that decrypt the header first (nfetch)
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

// node src/routes/middleware/requireToken.js, no env needed
if (require.main === module) {
  const a = require('assert');
  const check = (expected, header, transform) => {
    let out = 'next';
    const res = { status(n) { out = n; return this; }, json() {} };
    module.exports(expected, transform)({ headers: header === undefined ? {} : { authorization: header }, originalUrl: '/x' }, res, () => {});
    return out;
  };

  a.strictEqual(check('tok', 'tok'), 'next');
  a.strictEqual(check('tok', ' tok '), 'next');                           // trimmed
  a.strictEqual(check('tok', 'tok2'), 401);                               // longer
  a.strictEqual(check('tok', 'tak'), 401);                                // same length, wrong
  a.strictEqual(check('tok', ''), 401);
  a.strictEqual(check('tok', undefined), 401);                            // no header
  a.strictEqual(check(undefined, 'tok'), 500);                            // nothing configured never lets anyone in
  a.strictEqual(check('', ''), 500);
  a.strictEqual(check('tok', 'enc', h => h === 'enc' ? 'tok' : h), 'next'); // nfetch decrypts first
  a.strictEqual(check('tok', 'junk', () => { throw new Error('bad decrypt'); }), 401);
  console.log('requireToken ok');
}
