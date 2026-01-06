const dotenv = require('dotenv');
const dotenvResult = dotenv.config();
if (dotenvResult && dotenvResult.error) {
  console.log("DOT ENV]", dotenvResult.error)
}

const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// configs
const PRODUCTION_PUBLIC_DIRECTORY = path.join(__dirname, './dist')

let resolveMinify;
const minifyReady = new Promise(res => (resolveMinify = res));

app.use(async (req, res, next) => {
  await minifyReady;
  next();
});


(async () => {
  const { startMinify } = require('./modules/minify.js');

  // lmao imagine this thing fails
  await startMinify({
    src: path.join(__dirname, './public'),
    dest: PRODUCTION_PUBLIC_DIRECTORY
  });

  resolveMinify();
})();


// init
const { startCycler } = require('./heartSystem/heart.js');
startCycler();

const { loadAddresses } = require('./routes/classes/addressRegistry/addressManager.js') // getAddressMap
loadAddresses();

app.set('trust proxy', 1);

app.use(require('./routes/middleware/ratelimit.js'));
app.use(require('./routes/middleware/reqLogger.js'));
//app.use(express.json({ limit: '4mb' })); if the anime map too big bruh
app.use(express.json());

const compression = require('compression');
app.use(compression({ threshold: 1024 })); // 1kb threshold

app.use(express.static(PRODUCTION_PUBLIC_DIRECTORY));

//

app.use('/api/rowadb', require('./routes/middleware/rowadb_middlware.js'))

// routes 
const page = file => (req, res) => res.sendFile(file, { root: PRODUCTION_PUBLIC_DIRECTORY });
app.get('/home',       page('/index.html'));
app.get('/c4',         page('/c4/connect4.html'));
app.get('/avyTos',     page('/avyTOS.html'));
app.get('/avyprivacy', page('/avyPrivacy.html'));
app.get('/change',     page('/change.html'));
app.get('/quad',       page('/quadratic.html'));
app.get('/coinsort',   page('/change.html'));
app.get('/journal',    page('/journal/journal.html'));
app.get('/deepwoken',  page('/deepwoken.html'));
app.get('/anime',      page('/anime.html'));
app.get('/encryption', page('/encryption/cbc.html'));
app.get('/trafic',     page('/api.html'));
app.get('/anime2',     page('/anime2/main.html'));

const apiRoutes = require('./routes/api/apiRouter.js');
app.use('/api', apiRoutes);

const authRoutes = require('./routes/auth/authRouter.js');
app.use('/auth', authRoutes);

app.get('/info',                    require('./routes/info.js')                    );
app.get('/r',                       require('./routes/r.js')                       ); // request token

app.post('/webhook',                require('./routes/webhooks/webhook.js')        );
app.post('/webhook2',               require('./routes/webhooks/webhook2.js')       );

app.post('/c',                      require('./routes/c.js')                       );
app.post('/validate-me',            require('./routes/validate_me.js')             );

app.post('/dashboard',              require('./routes/dashboard.js')               );

app.post('/nfetch',                 require('./routes/nfetch.js')                  );
 

const { startrbx } = require('./routes/rblxapp/robloxstuff.js')
startrbx(app)

function toBase64(num) {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32BE(num);
  return buffer.toString("base64");
}

const { hashDirectory } = require('./modules/hashDirectory.js');
const server = app.listen(PORT, () => {
  const hash = hashDirectory(__dirname);
  console.log(`[Server] running on port ${PORT}, Hash ${toBase64(hash)}`);
});

const serverWSS = require('./modules/serverWSS.js')
const newWS = serverWSS.start(server);
const activityStatus = require('./routes/activityStatus.js')
app.post('/presence', activityStatus.start(newWS));

app.use((req, res) => {
  res.status(404).type('text').send(`Not found LOL 🥀💔 ${req.method} ${req.originalUrl}`);
});

//require('./firebase/firebasedb2.js');

const { healthCheck: rowaHealthCheck, ensureTables: rowaEnsureTables } = require('./DATABASE/rowaDB.js');
const { healthCheck: utilHealthCheck, ensureTables: utilEnsureTables } = require('./DATABASE/utilDB.js');

(async () => {
  const ok = await rowaHealthCheck()
  const ok2 = await utilHealthCheck()
  if (ok & ok2) {
    console.log('[POSTGRES_DB] ready to use')
    await rowaEnsureTables();
    await utilEnsureTables();
    console.log('[POSTGRES_DB] init success!')
  } else {
    console.log('[POSTGRES_DB] connection issue.')
  }
})()