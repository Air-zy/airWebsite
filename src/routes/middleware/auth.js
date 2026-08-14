const crypto = require('crypto');
const envDecrypt = require('../../FallbackEncryption/envDecrypt.js');

// throws at boot if sessionSecret is missing, which is what we want.
// never fall back to a default, a guessable signing key means forgeable cookies.
const SECRET = envDecrypt(process.env.airKey, process.env.sessionSecret);

const NAME = 'airzy_session';
const MAX_AGE = 7 * 24 * 60 * 60 * 1000;

function sign(data) {
  return crypto.createHmac('sha256', SECRET).update(data).digest('base64url');
}

// ponytail: no per token revocation before expiry. rotating sessionSecret logs everyone out.
// if per device logout is ever needed, add a tokenVersion int to the account doc and mix it into extra.
// extra is mixed into the signature but not sent, callers must know it to verify
function makeToken(data, extra = '') {
  return `${data}.${sign(data + extra)}`;
}

// returns the data string or null. last dot separated field must be the expiry.
function readToken(token, extra = '') {
  if (typeof token !== 'string') return null;

  const i = token.lastIndexOf('.');
  if (i < 1) return null;

  const data = token.slice(0, i);
  const got = Buffer.from(token.slice(i + 1), 'base64url');
  const want = Buffer.from(sign(data + extra), 'base64url');

  // timingSafeEqual throws on length mismatch so check that first
  if (got.length !== want.length || !crypto.timingSafeEqual(got, want)) return null;

  const parts = data.split('.');
  if (!(Number(parts[parts.length - 1]) > Date.now())) return null;

  return data;
}

function setAuthCookie(req, res, uid) {
  const expiresAt = Date.now() + MAX_AGE;
  res.cookie(NAME, makeToken(`${uid}.${expiresAt}`), {
    httpOnly: true,
    secure: req.secure, // https in prod via trust proxy, off on localhost
    sameSite: 'Lax',
    maxAge: MAX_AGE
  });
}

function clearAuthCookie(req, res) {
  res.clearCookie(NAME, { httpOnly: true, secure: req.secure, sameSite: 'Lax' });
}

function attachUser(req, res, next) {
  const data = readToken(req.cookies?.[NAME]);
  if (data) {
    const [uid, expiresAt] = data.split('.');
    req.user = { uid: Number(uid), expiresAt: Number(expiresAt) };
    // slide the window so active users dont get logged out on a fixed schedule
    if (req.user.expiresAt - Date.now() < MAX_AGE / 2) setAuthCookie(req, res, req.user.uid);
  } else {
    req.user = null;
  }
  next();
}

function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'not-authenticated' });
  next();
}

const RESET_TTL = 30 * 60 * 1000;

// the accounts current passwordHash is mixed into the signature, so the moment the
// password changes every outstanding reset token stops verifying. thats single use for free.
// the pw. prefix is domain separation so a reset token can never be replayed as a session cookie.
function makeResetToken(uid, passwordHash) {
  return makeToken(`pw.${uid}.${Date.now() + RESET_TTL}`, passwordHash);
}

// uid lives in field 1. read it before verifying so the caller can load the account
// and get the passwordHash needed to check the signature.
function parseResetUid(token) {
  const parts = String(token || '').split('.');
  if (parts[0] !== 'pw') return null;
  const uid = Number(parts[1]);
  return Number.isInteger(uid) && uid > 0 ? uid : null;
}

// returns the uid or null
function readResetToken(token, passwordHash) {
  const data = readToken(token, passwordHash);
  if (!data) return null;
  const parts = data.split('.');
  if (parts[0] !== 'pw') return null;
  return Number(parts[1]);
}

// uid 1 is the owner account. a hardcoded compare beats a roles system for one admin.
const ADMIN_UID = 1;

function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'not-authenticated' });
  if (req.user.uid !== ADMIN_UID) return res.status(403).json({ error: 'forbidden' });
  next();
}

module.exports = {
  makeToken, readToken,
  makeResetToken, readResetToken, parseResetUid,
  setAuthCookie, clearAuthCookie, attachUser, requireAuth, requireAdmin
};

// run directly to check the signing logic: node --env-file=.env src/routes/middleware/auth.js
if (require.main === module) {
  const a = require('assert');
  const future = Date.now() + 60000;

  const t = makeToken(`7.${future}`);
  a.strictEqual(readToken(t), `7.${future}`);
  a.strictEqual(readToken(t.slice(0, -1) + 'x'), null);        // tampered signature
  a.strictEqual(readToken(makeToken(`7.${Date.now() - 1}`)), null); // expired
  a.strictEqual(readToken('garbage'), null);
  a.strictEqual(readToken(''), null);
  a.strictEqual(readToken(undefined), null);

  // extra must match or the token is rejected, this is what makes reset tokens single use
  a.strictEqual(readToken(makeToken(`pw.7.${future}`, 'hashA'), 'hashA'), `pw.7.${future}`);
  a.strictEqual(readToken(makeToken(`pw.7.${future}`, 'hashA'), 'hashB'), null);

  // reset tokens
  const rt = makeResetToken(7, 'oldhash');
  a.strictEqual(parseResetUid(rt), 7);
  a.strictEqual(readResetToken(rt, 'oldhash'), 7);
  // using the token changes the password, which changes the hash, which kills the token
  a.strictEqual(readResetToken(rt, 'newhash'), null);
  // a session cookie must never verify as a reset token, and vice versa
  a.strictEqual(parseResetUid(makeToken(`7.${future}`)), null);
  a.strictEqual(readResetToken(makeToken(`7.${future}`), ''), null);

  console.log('auth ok');
  process.exit(0);
}
