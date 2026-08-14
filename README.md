# airWebsite

Monolith personal site on Node and Express. Portfolio, plus a bunch of tools and demos (anime relationship graph, connect 4 AI, quadtree stuff, ROWA leaderboards). Runs at [airzy.ca](https://airzy.ca).

Firestore for most data, one postgres db for the anime blob. Assets get minified from `src/public` into `src/dist` at boot. Secrets are stored encrypted with a hand written AES-128-CBC module in `src/FallbackEncryption/`.

No auth, session, validation or mail library. All hand rolled on node builtins to keep deps down.

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
| `resendKey` | optional. without it reset links print to console instead of emailing |
| `airWebToken` | admin and roblox endpoints |
| `UTIL_DB` | postgres connection json for the anime store |

`sessionSecret` is fatal on purpose. A signing key falling back to a default means forgeable cookies, so it crashes at boot instead.

## Layout

```
src/
├── server.js               middleware stack, five router mounts, 404, error handler
├── DATABASE/               postgres
├── FallbackEncryption/     AES-128-CBC
├── firebase/               firestore
├── heartSystem/            keeps external services warm
├── modules/                account service, mailer, minifier
├── public/                 frontend source
└── routes/
    ├── pagesRouter.js      static pages
    ├── rootRouter.js       top level endpoints
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

Reset tokens reuse the same signer, but mix the account's current `passwordHash` into the signature. Using one changes the password, which changes the hash, which kills every outstanding token for that account. Single use with nothing stored.

Two ceilings, both deliberate:

- no per token revocation. rotating `sessionSecret` is the break glass and logs everyone out. add a `tokenVersion` on the account doc if per device logout is ever wanted.
- no email verification. reset already proves mailbox control. this is also why changing your email isnt in the UI, an unverified change would be a takeover path.

| route | |
| --- | --- |
| `POST /auth/register` | create account, logs you in |
| `POST /auth/login` | log in |
| `POST /auth/logout` | clear cookie |
| `GET /auth/me` | current user, email masked |
| `POST /auth/password` | change password, needs the current one |
| `POST /auth/reset/request` | email a reset link, never says whether the address exists |
| `POST /auth/reset/confirm` | set new password from a token, logs you in |
| `GET /auth/account/:uid` | public lookup, no email |

Machine to machine endpoints use a shared bearer token instead, see `routes/middleware/requireToken.js`.

## Weird bits

Things that look wrong at a glance but arent, so nobody "fixes" them:

- Hand written AES instead of `node:crypto`. Its also the demo behind `/encryption`, and only touches env secrets. Sessions use hmac, passwords use argon2.
- `envDecrypt` reads its own stack trace and warns if the caller isnt under `src/`. Tripwire for a dependency that starts asking for secrets.
- Build runs at server start. Free hosts redeploy from source with no build step, so minify happens at boot behind a promise gate.
- Heartbeat pings a gist for its peer list. Keeps sleepy free containers awake, jittered 2 to 10 min with a rotating UA so it doesnt read as a bot.
- The `/c` fingerprint beacon is injected into every page at minify time. Self hosted analytics, no third party script.
- User agents get string compressed before storage (`Mozilla` to `Mzila`) to keep the address registry small.
- `/r` and `/dashboard` do an RSA handshake over https. Leftover admin login, not the user session system.

## Notes

- `/api/logs` is the raw request log, owner only (uid 1).
- `/api/cluster-units` needs an `Authorization` header, cluster nodes send `airWebToken`.
- Accounts made before email was required cant use reset until you add an `email` field and an `email:<lower>` index doc in the firestore console.
- No test framework. `auth.js` has a self check: `node --env-file=.env src/routes/middleware/auth.js`.
