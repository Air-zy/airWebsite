// shared helpers for the auth pages

var ERRORS = {
  'missing-fields': 'fill in every field',
  'invalid-credentials': 'wrong username or password',
  'username-taken': 'that username is taken',
  'username-invalid': '3-32 chars, letters numbers and _ only, not just digits',
  'username-inappropriate': 'pick a different username',
  'username-repetitive': 'that username is too repetitive',
  'password-too-short': 'password needs at least 8 characters',
  'password-too-long': 'password is too long',
  'google-off': 'google sign in isnt set up here',
  'google-failed': 'google sign in failed, try again',
  'google-cancelled': 'google sign in was cancelled',
  'not-authenticated': 'youre signed out',
  'too-many-attempts': 'too many attempts, wait a bit',
  'rate-limited': 'too many requests, wait a bit',
  'bad-request': 'that request was malformed',
  'server-error': 'server error, try again',
  'network-error': 'no connection'
};

function errMsg(code) {
  return ERRORS[code] || 'something went wrong';
}

// never throws, always returns an object with ok
function post(url, body) {
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {})
  }).then(function (res) {
    // the global limiter sends no body at all, so dont try to parse it
    if (res.status === 429) return { ok: false, error: 'rate-limited' };
    return res.json().catch(function () { return { error: 'server-error' }; })
      .then(function (data) {
        data.ok = res.ok;
        return data;
      });
  }).catch(function () {
    return { ok: false, error: 'network-error' };
  });
}

function getJSON(url) {
  return fetch(url).then(function (res) {
    if (res.status === 429) return { ok: false, error: 'rate-limited' };
    return res.json().catch(function () { return { error: 'server-error' }; })
      .then(function (data) {
        data.ok = res.ok;
        return data;
      });
  }).catch(function () {
    return { ok: false, error: 'network-error' };
  });
}

function say(el, text, kind) {
  el.textContent = text;
  el.className = 'response' + (kind ? ' ' + kind : '');
}

function togglePassword(btn, id) {
  var input = document.getElementById(id);
  var showing = input.type === 'text';
  input.type = showing ? 'password' : 'text';
  btn.setAttribute('aria-label', showing ? 'show password' : 'hide password');
}

// only allow same origin paths. parsed, since a startsWith('/') check lets /\evil.com through
function safeNext() {
  try {
    var u = new URL(new URLSearchParams(location.search).get('next') || '/', location.origin);
    if (u.origin === location.origin) return u.pathname + u.search + u.hash;
  } catch (e) {}
  return '/';
}

// disables the button while fn runs so double submits cant happen
function withBusy(btn, label, fn) {
  var old = btn.textContent;
  btn.disabled = true;
  btn.textContent = label;
  return Promise.resolve()
    .then(fn)
    .finally(function () {
      btn.disabled = false;
      btn.textContent = old;
    });
}
