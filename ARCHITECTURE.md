# Architecture

Diagrams only. Prose lives in the README.

## Request lifecycle

```mermaid
flowchart TD
  REQ([request]) --> GATE["minify gate<br/>waits only until boot build finishes"]
  GATE --> RL["rate limit<br/>30 per 30s per ip"]
  RL --> LOG["reqLogger<br/>writes trafic.log, 301s old hostnames"]
  LOG --> JSON["express.json"]
  JSON --> GZIP["compression"]
  GZIP --> CK["cookieParser"]
  CK --> AU["attachUser<br/>reads signed cookie, sets req.user, no io"]
  AU --> STATIC["express.static (src/dist)"]

  STATIC -->|no file match| MOUNTS
  STATIC -->|file found| FILE([static asset])

  subgraph MOUNTS["router mounts, in order"]
    direction TB
    API["/api  apiRouter"]
    AUTH["/auth  authRouter"]
    PAGES["/  pagesRouter"]
    ROOT["/  rootRouter"]
    RBLX["/  rblxapp router"]
    API --> AUTH --> PAGES --> ROOT --> RBLX
  end

  MOUNTS -->|matched| HANDLER([handler response])
  MOUNTS -->|nothing matched| NF["404 handler"]

  HANDLER -.->|throws or rejects| ERR
  NF --> OUT([response])
  ERR["error handler<br/>err.status or 500, json body"] --> OUT
```

## Session cookie

```mermaid
flowchart LR
  subgraph MINT["issued on login, register and the google callback"]
    U["uid"] --> P
    E["expiresAt"] --> P
    P["payload = uid.expiresAt"] --> H["hmac sha256<br/>key = sessionSecret"]
    H --> T["uid.expiresAt.signature"]
  end

  T --> COOKIE["airzy_session<br/>httpOnly, sameSite Lax, 7 days"]

  COOKIE --> V{"attachUser<br/>on every request"}
  V -->|"bad signature<br/>(timingSafeEqual)"| NULL["req.user = null"]
  V -->|expired| NULL
  V -->|valid| USER["req.user = uid"]

  USER --> SLIDE{"past halfway<br/>of the 7 days?"}
  SLIDE -->|yes| REISSUE["re issue cookie<br/>active users never get logged out"]
  SLIDE -->|no| DONE([continue])
  REISSUE --> DONE

  NULL --> RA
  USER --> RA{"requireAuth<br/>requireAdmin"}
  RA -->|no user| E401["401 not-authenticated"]
  RA -->|uid is not ADMIN_UID| E403["403 forbidden"]
  RA -->|ok| ROUTE([route handler])
```

## Register, one Firestore transaction

```mermaid
sequenceDiagram
  participant C as client
  participant R as register.js
  participant M as accountsManager
  participant F as firestore

  C->>R: POST /auth/register {name, password}
  R->>M: register()
  M->>M: normalize + validate name, password
  M->>M: argon2 hash

  rect rgb(40,40,40)
    Note over M,F: transaction, all reads before any writes
    M->>F: get username:name
    F-->>M: exists?
    M->>F: get counter
    F-->>M: nextId

    alt username taken
      M-->>R: throw username-taken
      R-->>C: 409
    else free
      M->>F: set counter = nextId + 1
      M->>F: set secure/uid = account
      M->>F: set username:name = uid
    end
  end

  M-->>R: account
  R->>C: set session cookie
  R-->>C: 200 {uid, name} (already logged in)
```

## Continue with google, openid connect without a library

```mermaid
sequenceDiagram
  participant U as browser
  participant S as server
  participant G as google
  participant F as firestore

  U->>S: GET /auth/google?next=/somewhere
  S->>U: set g_state cookie = random.next, redirect
  U->>G: sign in, state = nonce = random
  G->>U: redirect to /auth/google/callback?code&state
  U->>S: callback, g_state cookie comes along (sameSite Lax)
  S->>S: state matches the cookie?

  alt no match or no code
    S-->>U: redirect /auth/?e=google-failed
  else match
    S->>G: POST token endpoint {code, client secret}
    G-->>S: id token
    Note over S,G: straight from google over https,<br/>so no signature check. iss, aud, exp, nonce checked
    S->>F: get google:sub
    alt linked
      F-->>S: uid
    else new
      S->>F: transaction, username:name + google:sub + account
      Note over S,F: first name, then name + 4 random digits if taken
    end
    S->>U: set session cookie, redirect to next
  end
```

## Boot sequence

```mermaid
flowchart TD
  START([npm start]) --> APP["create express app"]
  APP --> GATE["install minify gate"]

  GATE --> PAR{{"these run concurrently"}}
  PAR --> HEART["startCycler, heartbeat"]
  PAR --> ADDR["loadAddresses, firestore"]
  PAR --> PG["utilDB ensureTables"]

  GATE --> MW["middleware stack + router mounts"]
  MW --> LISTEN["app.listen"]
  LISTEN -->|port taken| DIE["throws, a second copy dies<br/>before it can touch src/dist"]
  LISTEN --> MIN["minify src/public into src/dist"]
  MIN --> OPEN["gate opens, requests flow"]
  OPEN --> UP([serving])

  SS{"sessionSecret set?"} -.-> MW
  APP --> SS
  SS -->|missing| CRASH["boot crash, deliberate<br/>never sign with a default key"]
```

## Where data lives

```mermaid
flowchart LR
  APP["airWebsite"]

  APP --> FS[("firestore")]
  FS --> A1["secure/*<br/>accounts, username + google indexes, counter"]
  FS --> A2["projects, roblox blob"]

  APP --> PG[("postgres UTIL_DB")]
  PG --> B1["notes<br/>the guestbook"]

  APP --> RBX{{"roblox open cloud"}}
  RBX --> C1["plrDataV3 datastore<br/>feeds /api/rowa/all and leaderboards"]

  APP --> GIST{{"github gist"}}
  GIST --> D1["encrypted cluster peer urls<br/>changed without redeploying"]

  APP --> GOO{{"google"}}
  GOO --> E1["continue with google<br/>token exchange only"]

  APP --> DISC{{"discord webhooks"}}
```

## Auth surface

```mermaid
flowchart TD
  subgraph PUB["public"]
    P1["POST /auth/register"]
    P2["POST /auth/login"]
    P3["GET /auth/google"]
    P4["GET /auth/google/callback"]
    P5["GET /auth/account/:uid"]
    P6["GET /api/notes"]
  end

  subgraph SESS["needs a session cookie"]
    S1["GET /auth/me"]
    S2["POST /auth/password"]
    S5["POST /auth/username"]
    S3["POST /auth/logout"]
    S4["POST /api/notes"]
  end

  subgraph ADMIN["owner only, ADMIN_UID in auth.js"]
    A1["GET /api/logs"]
    A2["POST /api/notes/:id/pin"]
    A3["DELETE /api/notes/:id"]
    A4["POST /api/projects/update"]
  end

  subgraph TOKEN["shared bearer token, machine to machine"]
    T1["POST /webhook, /webhook2"]
    T2["POST /nfetch"]
    T3["POST /gam3push"]
    T5["POST /api/gam3DB"]
    T6["GET /api/cluster-units"]
  end

  PUB --- RL1["rate limited per route"]
  SESS --- MW1["requireAuth"]
  ADMIN --- MW2["requireAdmin"]
  TOKEN --- MW3["requireToken, timingSafeEqual"]
```
