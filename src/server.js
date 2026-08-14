const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// configs
const PRODUCTION_PUBLIC_DIRECTORY = path.join(__dirname, './dist')

let minifyDone = false;
let resolveMinify;
const minifyReady = new Promise(res => (resolveMinify = () => { minifyDone = true; res(); }));

// only gate requests until the boot minify is done, after that skip straight through
app.use((req, res, next) => minifyDone ? next() : minifyReady.then(() => next()));


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

const { healthCheck: utilHealthCheck, ensureTables: utilEnsureTables } = require('./DATABASE/utilDB.js');

(async () => {
  if (await utilHealthCheck()) {
    console.log('[POSTGRES_DB] ready to use')
    await utilEnsureTables();
    console.log('[POSTGRES_DB] init success!')
  } else {
    console.log('[POSTGRES_DB] connection issue.')
  }
})()

app.set('trust proxy', 1);

app.use(require('./routes/middleware/ratelimit.js').clientLimiter);
app.use(require('./routes/middleware/reqLogger.js'));
//app.use(express.json({ limit: '4mb' })); if the anime map too big bruh
app.use(express.json());

const compression = require('compression');
app.use(compression({ threshold: 1024 })); // 1kb threshold

app.use(require('./routes/middleware/cookieParser.js'));
app.use(require('./routes/middleware/auth.js').attachUser);

//

app.use(express.static(PRODUCTION_PUBLIC_DIRECTORY));

//

// routes
app.use('/api',  require('./routes/api/apiRouter.js'));
app.use('/auth', require('./routes/auth/authRouter.js'));
app.use('/',     require('./routes/pagesRouter.js'));
app.use('/',     require('./routes/rootRouter.js'));
app.use('/',     require('./routes/rblxapp/router.js'));

app.use((req, res) => {
  res.status(404).type('text').send(`Not found LOL 🥀💔 ${req.method} ${req.originalUrl}`);
});

// express 5 forwards async handler rejections here, so this catches most thrown errors
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);

  // body parser and friends set a status, a malformed json body is a 400 not a 500
  const status = err.status || err.statusCode || 500;
  if (status >= 500) console.error('[unhandled]', req.method, req.originalUrl, err);

  res.status(status).json({ error: status === 400 ? 'bad-request' : 'Internal server error' });
});

const server = app.listen(PORT, () => {
  console.log(`[Server] running on port ${PORT}`);
});

//require('./firebase/firebasedb2.js');