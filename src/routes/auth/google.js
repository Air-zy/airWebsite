const crypto = require('crypto');
const envDecrypt = require('../../FallbackEncryption/envDecrypt.js');
const { setAuthCookie } = require('../middleware/auth.js');
const { loginWithGoogle } = require('../../modules/account/accountsManager.js');

// optional, without them the button just says google sign in is off
const CLIENT_ID = process.env.googleClientId ? envDecrypt(process.env.airKey, process.env.googleClientId) : null;
const CLIENT_SECRET = process.env.googleClientSecret ? envDecrypt(process.env.airKey, process.env.googleClientSecret) : null;

const COOKIE = 'g_state';
const COOKIE_OPTS = { httpOnly: true, sameSite: 'Lax', path: '/auth/google' };

// the host header is attacker controlled, but google only redirects to uris registered
// in the console, so a spoofed one just gets an error page from google
function redirectUri(req) {
  return `${req.protocol}://${req.get('host')}/auth/google/callback`;
}

// same origin paths only. parsing it catches /\evil.com and friends that a startsWith check lets through
function safePath(next) {
  try {
    const u = new URL(next, 'http://x');
    if (u.host === 'x') return u.pathname + u.search + u.hash;
  } catch {}
  return '/';
}

function fail(res, code) {
  res.redirect(`/auth/?e=${code}`);
}

function start(req, res) {
  if (!CLIENT_ID || !CLIENT_SECRET) return fail(res, 'google-off');

  // one random value as both state and nonce. state ties the callback to this browser,
  // nonce ties the id token to it, and google requires the nonce
  const state = crypto.randomBytes(32).toString('base64url');
  const next = Buffer.from(String(req.query.next || '/')).toString('base64url');
  res.cookie(COOKIE, `${state}.${next}`, { ...COOKIE_OPTS, secure: req.secure, maxAge: 10 * 60 * 1000 });

  res.redirect('https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: redirectUri(req),
    response_type: 'code',
    scope: 'openid profile',
    state,
    nonce: state
  }));
}

async function callback(req, res) {
  const [state, next] = String(req.cookies[COOKIE] || '').split('.');
  res.clearCookie(COOKIE, { ...COOKIE_OPTS, secure: req.secure });

  // no match means a forged callback or an expired cookie. error=access_denied is them pressing cancel
  if (!state || req.query.state !== state) return fail(res, 'google-failed');
  if (typeof req.query.code !== 'string') return fail(res, 'google-cancelled');

  try {
    const r = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      body: new URLSearchParams({
        code: req.query.code,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: redirectUri(req),
        grant_type: 'authorization_code'
      })
    });
    if (!r.ok) {
      console.error('[google] token exchange failed', r.status, await r.text().catch(() => ''));
      return fail(res, 'google-failed');
    }

    // no signature check. it came straight from google over https with our secret, which google says is enough
    const { id_token } = await r.json();
    const claims = JSON.parse(Buffer.from(String(id_token).split('.')[1], 'base64url').toString());
    if (!checkClaims(claims, state)) return fail(res, 'google-failed');

    const acc = await loginWithGoogle(claims.sub, claims.given_name);
    setAuthCookie(req, res, acc.uid);
    res.redirect(safePath(Buffer.from(next || '', 'base64url').toString()));
  } catch (err) {
    console.error('[google] callback failed', err);
    fail(res, 'google-failed');
  }
}

// googles list minus the signature, see the comment above
function checkClaims(c, nonce) {
  return ['https://accounts.google.com', 'accounts.google.com'].includes(c.iss)
    && c.aud === CLIENT_ID
    && c.exp * 1000 > Date.now()
    && c.nonce === nonce
    && typeof c.sub === 'string' && c.sub.length > 0;
}

module.exports = { start, callback };

// node --env-file=.env src/routes/auth/google.js
if (require.main === module) {
  const a = require('assert');

  a.strictEqual(safePath('/auth/profile.html'), '/auth/profile.html');
  a.strictEqual(safePath('/a?b=1#c'), '/a?b=1#c');
  a.strictEqual(safePath('/'), '/');
  a.strictEqual(safePath('//evil.com'), '/');
  a.strictEqual(safePath('/\\evil.com'), '/');
  a.strictEqual(safePath('/\t/evil.com'), '/');
  a.strictEqual(safePath('https://evil.com/x'), '/');
  a.strictEqual(safePath('javascript:alert(1)'), '/');
  a.strictEqual(safePath(''), '/');

  const good = { iss: 'https://accounts.google.com', aud: CLIENT_ID, exp: Date.now() / 1000 + 60, nonce: 'n', sub: '123' };
  a.ok(checkClaims(good, 'n'));
  a.ok(checkClaims({ ...good, iss: 'accounts.google.com' }, 'n'));
  a.ok(!checkClaims({ ...good, iss: 'https://evil.com' }, 'n'));
  a.ok(!checkClaims({ ...good, aud: 'someone-else' }, 'n'));
  a.ok(!checkClaims({ ...good, exp: Date.now() / 1000 - 1 }, 'n'));
  a.ok(!checkClaims({ ...good, nonce: 'other' }, 'n'));
  a.ok(!checkClaims({ ...good, sub: '' }, 'n'));
  a.ok(!checkClaims({ ...good, sub: undefined }, 'n'));

  console.log('google ok');
  process.exit(0);
}
