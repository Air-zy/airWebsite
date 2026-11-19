# Architecture

Diagrams only. Prose lives in the README.

## Request lifecycle

```mermaid
flowchart TD
  REQ([request]) --> GATE["minify gate<br/>waits only until boot build finishes"]
  GATE --> LOG["reqLogger<br/>writes trafic.log, 301s old hostnames"]
  LOG --> JSON["express.json"]
  JSON --> GZIP["compression<br/>brotli 11 for js css svg tsv, 5 for the rest"]
  GZIP --> CK["cookieParser"]
  CK --> AU["attachUser<br/>reads signed cookie, sets req.user, no io"]
  AU --> TERM{"terminal<br/>/ and /home only"}
  TERM -->|"curl, wget"| CARD([animated ascii card])
  TERM -->|"ai agents, bare http libraries"| PLAIN([plain text card])
  TERM -->|browser| FA["/auth only: frame-ancestors 'self'"]
  FA --> BR{"precompress.serve<br/>.br written at boot?"}
  BR -->|"yes, and the browser takes br"| FILE([static asset])
  BR -->|not yet| STATIC["express.static (src/dist)"]

  STATIC -->|file found| FILE
  STATIC -->|"a folder with no slash, /chess"| SLASH(["301 to /chess/"])
  STATIC -->|no file match| RL["rate limit<br/>30 per 30s per ip<br/>rowa-rig and rowa-asset have their own"]
  RL --> MOUNTS

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
  R-->>C: 200 {uid, name, createdAt} (already logged in)
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

  alt no match
    S-->>U: redirect /auth/?e=google-failed
  else no code, they pressed cancel
    S-->>U: redirect /auth/?e=google-cancelled
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
  PAR --> PROJ["projects read from firestore<br/>when its router is required"]

  GATE --> MW["middleware stack + router mounts"]
  MW --> LISTEN["app.listen"]
  LISTEN -->|port taken| DIE["throws, a second copy dies<br/>before it can touch src/dist"]
  LISTEN --> MIN["minify src/public into src/dist<br/>fills site.js tokens, injects the /c beacon"]
  MIN --> OPEN["gate opens, requests flow"]
  OPEN --> UP([serving])
  OPEN --> PRE["precompress<br/>brotli every page and asset once, smallest first<br/>each file served from its .br once written<br/>files over 10 MB go out as they are"]

  SS{"sessionSecret set?"} -.-> MW
  APP --> SS
  SS -->|missing| CRASH["boot crash, deliberate<br/>never sign with a default key"]
```

## Where data lives

```mermaid
flowchart LR
  APP["airWebsite"]

  APP --> FS[("firestore<br/>firebaseJsonKey")]
  FS --> A1["secure/*<br/>accounts, username + google indexes, counter"]
  FS --> A2["tokenUsage/airsite<br/>projects, views as +1s"]
  FS --> A3["tokenUsage/people2<br/>the friends list"]
  FS --> A4["tokenUsage/adresses2<br/>visitor registry, gzipped"]
  FS --> A5["tokenUsage/rblx<br/>roblox blob, /api/gam3DB"]

  APP --> FS2[("firestore 2<br/>firebaseJsonKey2")]
  FS2 --> A6["def/anime chunks<br/>the anime graph's data and coords<br/>read once, kept brotlied"]

  APP --> FS3[("avy's firestore<br/>azyFirebaseJSON")]
  FS3 --> A7["status/main<br/>my discord status, /presence and last online"]

  APP --> PG[("postgres UTIL_DB")]
  PG --> B1["notes<br/>the guestbook"]

  APP --> RBX{{"roblox open cloud"}}
  RBX --> C1["plrDataV3 datastore<br/>feeds /api/rowa/all and leaderboards"]
  RBX --> C2["users, thumbnails, asset delivery<br/>the rowa2 figures"]

  APP --> RBXP{{"roblox public apis"}}
  RBXP --> C3["games and visits<br/>/api/roblox-stats, every 6 hours at most"]

  APP --> GIST{{"github gist"}}
  GIST --> D1["encrypted cluster peer urls<br/>changed without redeploying"]

  APP --> GH{{"github repo"}}
  GH --> D2["Air-zy/robloxStudio<br/>/gam3push commits files with repoPat"]

  APP --> HF{{"hugging face space"}}
  HF --> D3["/api/imggen"]

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
    P7["POST /auth/logout<br/>just clears the cookie"]
    P6["GET /api/notes"]
  end

  subgraph SESS["needs a session cookie"]
    S1["GET /auth/me"]
    S2["POST /auth/password"]
    S5["POST /auth/username"]
    S4["POST /api/notes"]
    S6["DELETE /api/notes/:id<br/>your own note"]
  end

  subgraph ADMIN["owner only, ADMIN_UID in auth.js"]
    A1["GET /api/logs"]
    A2["POST /api/notes/:id/pin"]
    A3["DELETE /api/notes/:id<br/>any note"]
    A4["POST /api/projects/update"]
    A5["GET /api/people/list"]
    A6["POST /api/people/update"]
  end

  subgraph TOKEN["bearer token, machine to machine, each its own env var"]
    T1["POST /webhook, /webhook2<br/>whookPass"]
    T2["POST /nfetch<br/>airClusterAcolyteToken, header decrypted with publicClusterKey first"]
    T3["POST /gam3push<br/>airWebToken2"]
    T5["POST /api/gam3DB<br/>airWebToken"]
    T6["GET /api/cluster-units<br/>airWebToken"]
  end

  PUB --- RL1["rate limited per route"]
  SESS --- MW1["requireAuth"]
  ADMIN --- MW2["requireAdmin"]
  TOKEN --- MW3["requireToken, timingSafeEqual"]
```
