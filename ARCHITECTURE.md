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
  subgraph MINT["issued on login, register and reset confirm"]
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
  RA -->|uid is not 1| E403["403 forbidden"]
  RA -->|ok| ROUTE([route handler])
```

## Register, one Firestore transaction

```mermaid
sequenceDiagram
  participant C as client
  participant R as register.js
  participant M as accountsManager
  participant F as firestore

  C->>R: POST /auth/register {name, email, password}
  R->>M: register()
  M->>M: normalize + validate name, email, password
  M->>M: argon2 hash

  rect rgb(40,40,40)
    Note over M,F: transaction, all reads before any writes
    M->>F: get username:name
    F-->>M: exists?
    M->>F: get email:email
    F-->>M: exists?
    M->>F: get counter
    F-->>M: nextId

    alt username or email taken
      M-->>R: throw username-taken / email-taken
      R-->>C: 409
    else free
      M->>F: set counter = nextId + 1
      M->>F: set secure/uid = account
      M->>F: set username:name = uid
      M->>F: set email:email = uid
    end
  end

  M-->>R: account
  R->>C: set session cookie
  R-->>C: 200 {uid, name} (already logged in)
```

## Password reset, single use without stored state

```mermaid
sequenceDiagram
  participant U as user
  participant S as server
  participant F as firestore
  participant MAIL as resend

  U->>S: POST /auth/reset/request {email}
  S-->>U: 200 {ok:true}
  Note over S,U: replies before the lookup.<br/>constant time, never reveals if the address exists

  S->>F: lookup email index
  F-->>S: account (uid + current passwordHash)
  S->>S: token = pw.uid.exp + hmac(pw.uid.exp + passwordHash)
  Note over S: the CURRENT hash is baked into the signature
  S->>MAIL: reset link (or console when resendKey unset)
  MAIL-->>U: airzy.ca/auth/reset.html#t=token
  Note over U: token is in the fragment,<br/>so it never reaches the server log

  U->>S: POST /auth/reset/confirm {token, password}
  S->>F: load account by uid from the token
  F-->>S: current passwordHash
  S->>S: verify signature using that hash

  alt signature matches
    S->>F: write new passwordHash
    S->>U: set session cookie
    S-->>U: 200, logged in
    Note over S,F: hash just changed, so the token<br/>can no longer verify
  else replayed or tampered
    S-->>U: 400 invalid-token
  end
```

## Boot sequence

```mermaid
flowchart TD
  START([npm start]) --> APP["create express app"]
  APP --> GATE["install minify gate"]

  GATE --> PAR{{"these run concurrently"}}
  PAR --> MIN["minify src/public into src/dist"]
  PAR --> HEART["startCycler, heartbeat"]
  PAR --> ADDR["loadAddresses, firestore"]
  PAR --> PG["utilDB health check + ensureTables"]

  GATE --> MW["middleware stack + router mounts"]
  MW --> LISTEN["app.listen"]
  LISTEN --> UP([serving])

  MIN --> OPEN["gate opens, requests flow"]
  OPEN --> UP

  SS{"sessionSecret set?"} -.-> MW
  APP --> SS
  SS -->|missing| CRASH["boot crash, deliberate<br/>never sign with a default key"]
```

## Where data lives

```mermaid
flowchart LR
  APP["airWebsite"]

  APP --> FS[("firestore")]
  FS --> A1["secure/*<br/>accounts, username + email indexes, counter"]
  FS --> A2["projects, anime map, roblox blob"]

  APP --> PG[("postgres UTIL_DB")]
  PG --> B1["big_value<br/>gzipped anime data"]

  APP --> RBX{{"roblox open cloud"}}
  RBX --> C1["plrDataV3 datastore<br/>feeds /api/rowa/all and leaderboards"]

  APP --> GIST{{"github gist"}}
  GIST --> D1["encrypted cluster peer urls<br/>changed without redeploying"]

  APP --> RES{{"resend"}}
  RES --> E1["password reset mail"]

  APP --> DISC{{"discord webhooks"}}
```

## Auth surface

```mermaid
flowchart TD
  subgraph PUB["public"]
    P1["POST /auth/register"]
    P2["POST /auth/login"]
    P3["POST /auth/reset/request"]
    P4["POST /auth/reset/confirm"]
    P5["GET /auth/account/:uid"]
  end

  subgraph SESS["needs a session cookie"]
    S1["GET /auth/me"]
    S2["POST /auth/password"]
    S3["POST /auth/logout"]
  end

  subgraph ADMIN["owner only, uid 1"]
    A1["GET /api/logs"]
  end

  subgraph TOKEN["shared bearer token, machine to machine"]
    T1["POST /webhook, /webhook2"]
    T2["POST /nfetch"]
    T3["POST /gam3push"]
    T4["POST /api/projects/update"]
    T5["POST /api/gam3DB"]
    T6["GET /api/cluster-units"]
  end

  PUB --- RL1["rate limited per route"]
  SESS --- MW1["requireAuth"]
  ADMIN --- MW2["requireAdmin"]
  TOKEN --- MW3["requireToken, timingSafeEqual"]
```
