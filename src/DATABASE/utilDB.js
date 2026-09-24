const postgres = require('postgres');
const envDecrypt = require('../FallbackEncryption/envDecrypt.js');

// UTIL_DB is an encrypted postgres url, the one neon hands out works as is
const url = new URL(envDecrypt(process.env.airKey, process.env.UTIL_DB));
// postgres.js sends url params it does not know to the server as settings, and the server rejects channel_binding.
// verify-full checks the server certificate instead, sslmode=require alone accepts any certificate
url.searchParams.delete('channel_binding');
url.searchParams.set('sslmode', 'verify-full');

const sql = postgres(url.href, {
  max: 5,
  idle_timeout: 10_000,
  connect_timeout: 30_000,
  onnotice: () => {}, // otherwise every boot prints "already exists, skipping" per table
});

// safe to run every boot
async function ensureTables() {
  // the guestbook on the home page, see routes/api/notes.js
  await sql`
    CREATE TABLE IF NOT EXISTS notes (
      id serial PRIMARY KEY,
      uid integer NOT NULL,
      name text NOT NULL,
      text text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      pinned_at timestamptz
    );
  `;
}

module.exports = { sql, ensureTables };
