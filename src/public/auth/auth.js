// shared helpers for the auth pages

var ERRORS = {
  'missing-fields': 'fill in every field',
  'invalid-credentials': 'wrong username or password',
  'username-taken': 'that username is taken',
  'username-invalid': '3-30 chars, letters numbers _ and - only',
  'email-taken': 'that email already has an account',
  'email-invalid': 'that email doesnt look right',
  'password-too-short': 'password needs at least 8 characters',
  'password-too-long': 'password is too long',
  'invalid-token': 'that link expired or was already used',
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

// only allow same origin paths, never a full url
function safeNext() {
  var next = new URLSearchParams(location.search).get('next');
  return next && next.charAt(0) === '/' && next.slice(0, 2) !== '//' ? next : '/';
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
