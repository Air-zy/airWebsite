# airWebsite

Monolith personal site on Node and Express. Portfolio, plus a bunch of tools and demos (anime relationship graph, connect 4 AI, quadtree stuff, ROWA leaderboards). Runs at [airzy.ca](https://airzy.ca).

Firestore for most data, one postgres db for the guestbook. Assets get minified from `src/public` into `src/dist` at boot. Secrets are stored encrypted with a hand written AES-128-CBC module in `src/FallbackEncryption/`.

No auth, session, validation or oauth library. All hand rolled on node builtins to keep deps down.

Diagrams of the request path, auth and boot are in [ARCHITECTURE.md](ARCHITECTURE.md).

## Setup

Needs node 20.6+ (the dev script uses `--env-file`).

```sh
npm install
cp .env.example .env    # then fill it in
npm run dev             # local, reads .env
npm start               # prod, env comes from the host
```

Serves on 3000 or `PORT`. First request waits for the minify pass to finish.

Most env values are encrypted with `airKey`, not plaintext. See `.env.example` for the full list. The ones worth calling out:

| var | |
| --- | --- |
| `airKey` | master key for the AES module, everything else depends on it |
| `sessionSecret` | signs session cookies. required, server wont boot without it |
| `googleClientId`, `googleClientSecret` | optional. continue with google, see Auth below |
| `airWebToken` | admin and roblox endpoints |
| `UTIL_DB` | encrypted neon postgres url, for the guestbook |

`sessionSecret` is fatal on purpose. A signing key falling back to a default means forgeable cookies, so it crashes at boot instead.

## Layout

```
src/
├── server.js               middleware stack, five router mounts, 404, error handler
├── config/                 site.js, the one copy of the socials, skills and nav
├── DATABASE/               postgres
├── FallbackEncryption/     AES-128-CBC
├── firebase/               firestore
├── heartSystem/            keeps external services warm
├── modules/                account service, minifier
├── public/                 frontend source
└── routes/
    ├── pagesRouter.js      static pages
    ├── rootRouter.js       top level endpoints
    ├── cli.js              the site as text, curl and the /cli terminal page
    ├── api/apiRouter.js    /api
    ├── auth/authRouter.js  /auth
    ├── rblxapp/            roblox
    ├── middleware/         auth, rate limit, request log, cookies
    └── classes/            address registry, session registry, api clients
```

Every route lives in a `Router()`. `server.js` only mounts them, it declares none itself.

## Auth

Sessions are a stateless signed cookie, no server side state:

```
airzy_session = <uid>.<expiresAt>.<hmac-sha256 of the above>
```

Signed with `sessionSecret`, checked with `timingSafeEqual`, `httpOnly` + `sameSite=Lax`. Seven day window that slides when you show up past the halfway mark. Survives redeploys and costs no db read to verify.

Two ways in, a username and password, or continue with google. No email anywhere, so there is no password reset.
A forgotten password on a password account is fixed by hand in the firestore console.

Google is plain openid connect with no library. `/auth/google` sets a random value in a cookie and sends it to google as both
`state` and `nonce`, the callback checks both, swaps the code for an id token and checks `iss`, `aud` and `exp`.
No signature check, the token comes straight from google over https with our secret, which google says is enough.
Accounts are keyed on google's `sub` through a `google:<sub>` index doc, never on email.
New google accounts get their first name as a username, plus random digits if its taken, and can rename from the profile page.
They have no password, so password login and change password dont apply to them.

To turn it on, make a web oauth client in google cloud console, add `https://airzy.ca/auth/google/callback`
(and `http://localhost:3000/auth/google/callback` for dev) as redirect uris, then put the id and secret in `.env` encrypted with `airKey`.

One ceiling, deliberate: no per token revocation. rotating `sessionSecret` is the break glass and logs everyone out.
add a `tokenVersion` on the account doc if per device logout is ever wanted.

| route | |
| --- | --- |
| `POST /auth/register` | create account, logs you in |
| `POST /auth/login` | log in |
| `POST /auth/logout` | clear cookie |
| `GET /auth/google` | start continue with google, redirects to google |
| `GET /auth/google/callback` | google sends you back here, logs you in or makes the account |
| `GET /auth/me` | current user |
| `POST /auth/password` | change password, needs the current one |
| `POST /auth/username` | rename, the old name is free straight away |
| `GET /auth/account/:uid` | public lookup, name and join date only |

Machine to machine endpoints use a shared bearer token instead, see `routes/middleware/requireToken.js`.

## Weird bits

Things that look wrong at a glance but arent, so nobody "fixes" them:

- Hand written AES instead of `node:crypto`. Its also the demo behind `/encryption`, and only touches env secrets. Sessions use hmac, passwords use argon2.
- `envDecrypt` reads its own stack trace and warns if the caller isnt under `src/`. Tripwire for a dependency that starts asking for secrets.
- Build runs at server start. Free hosts redeploy from source with no build step, so minify happens at boot behind a promise gate.
- Heartbeat pings a gist for its peer list. Keeps sleepy free containers awake, jittered 2 to 10 min with a rotating UA so it doesnt read as a bot.
- `middleware/terminal.js` sits before `express.static` on purpose. It has to, or `index.html` answers `/` first.
  curl and wget get an ascii card instead of html, `Accept: text/html` opts back out.
- `/cli` serves the same text to both. curl gets it raw, browsers get `cli.html`, a terminal that fetches `/cli/<command>`
  and paints the ansi codes as spans. `routes/cli.js` reads its page list back out of `pagesRouter.stack` so the list only exists once.
- The `/c` fingerprint beacon is injected into every page at minify time. Self hosted analytics, no third party script.
- Socials, skills, the nav, the about text and the copyright live once, in `config/site.js`. The minifier swaps `<!--#socialIcons-->` and friends for real markup on the
  way to `dist`, so `index.html` holds tokens instead of link lists and `cli.js` reads the same array. A typo'd token kills the
  build for that page on purpose, `removeComments` would have eaten it silently.
  The about lines use `{phrase|#color}` so the page can tint a phrase and the cli can drop the braces. The "here to develop"
  line is not in there on purpose, `main.js` animates it by id.
- User agents get string compressed before storage (`Mozilla` to `Mzila`) to keep the address registry small.
- `/r` and `/dashboard` do an RSA handshake over https. Leftover admin login, not the user session system.

## Notes

- `/api/logs` is the raw request log, owner only (`ADMIN_UID` in `auth.js`).
- The guestbook (`/api/notes`) is public to read and needs an account to sign. Anyone can write one, a 401 on send opens
  `/auth/` in a popup iframe that posts `signed-in` back instead of redirecting. Google cannot be framed so it takes the tab,
  the note waits in sessionStorage until it lands back on `/home#guestbook`. The owner pins and deletes from the page,
  pinning is also the sort, the last pin sits on top. Notes store the uid, names are looked up in one batched firestore read
  and cached in memory so renames show on old notes.
- Older accounts still have an `email` field and `email:<address>` index docs in firestore. Nothing reads them, safe to delete.
- `/api/cluster-units` needs an `Authorization` header, cluster nodes send `airWebToken`.
- No test framework. A few files have a self check you run directly:
  `node --env-file=.env src/routes/middleware/auth.js`, same for `middleware/terminal.js`, `routes/cli.js`, `routes/api/notes.js`,
  `routes/auth/google.js` and `modules/account/accountsManager.js`,
  and `node src/config/site.js` (no env needed, it checks the tokens in index.html still line up).
  `node src/config/blueNoise.js` regenerates the auth page dither tile and checks it, same png every run.
