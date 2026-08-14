const envDecrypt = require('../FallbackEncryption/envDecrypt.js');

// optional on purpose, unlike sessionSecret. a missing mail key must not take the site down,
// and the no key branch below makes the whole reset flow testable locally with zero setup.
const KEY = process.env.resendKey ? envDecrypt(process.env.airKey, process.env.resendKey) : null;

const FROM = 'airzy <noreply@airzy.ca>';

// hardcoded on purpose. never build this from req.get('host'), the host header is
// attacker controlled and host header injection into reset links is how this flow gets abused.
const SITE_URL = 'https://airzy.ca';

// never throws. returns true if the provider accepted it.
async function sendMail(to, subject, text) {
  if (!KEY) {
    console.log('[mail] no resendKey set, would have sent to', to, '\n' + text);
    return true;
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to, subject, text })
    });

    if (!res.ok) {
      console.error('[mail] failed', res.status, await res.text().catch(() => ''));
      return false;
    }
    return true;
  } catch (err) {
    console.error('[mail] error', err);
    return false;
  }
}

function sendResetMail(to, name, token) {
  return sendMail(to, 'Reset your airzy password',
    `Someone asked to reset the password for ${name}.\n\n` +
    `${SITE_URL}/auth/reset.html#t=${token}\n\n` +
    `The link works for 30 minutes. If this wasnt you, ignore this email.`);
}

module.exports = { sendMail, sendResetMail, SITE_URL };
