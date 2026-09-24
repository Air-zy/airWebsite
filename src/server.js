const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const PRODUCTION_PUBLIC_DIRECTORY = path.join(__dirname, './dist')

let minifyDone = false;
let resolveMinify;
const minifyReady = new Promise(res => (resolveMinify = () => { minifyDone = true; res(); }));

// only gate requests until the boot minify is done, after that skip straight through.
// the minify itself starts in the listen callback at the bottom
app.use((req, res, next) => minifyDone ? next() : minifyReady.then(() => next()));

const { startCycler } = require('./heartSystem/heart.js');
startCycler();

const { loadAddresses } = require('./routes/classes/addressRegistry/addressManager.js')
loadAddresses();

require('./DATABASE/utilDB.js').ensureTables()
  .then(() => console.log('[POSTGRES_DB] ready'))
  .catch(err => console.error('[POSTGRES_DB] connection issue:', err.message));

app.set('trust proxy', 1);

app.use(require('./routes/middleware/reqLogger.js'));
app.use(express.json());

const compression = require('compression');
app.use(compression({ threshold: 1024 }));

app.use(require('./routes/middleware/cookieParser.js'));
app.use(require('./routes/middleware/auth.js').attachUser);

// before static, otherwise index.html answers / first
app.use(require('./routes/middleware/terminal.js').middleware);

// only this site may frame the login pages (the guestbook popup), anyone else is clickjacking
app.use('/auth', (req, res, next) => { res.set('Content-Security-Policy', "frame-ancestors 'self'"); next(); });

app.use(express.static(PRODUCTION_PUBLIC_DIRECTORY));

// after static so css and js dont eat the budget, a few refreshes used to hit 30. after the logger so a 429 gets logged
app.use(require('./routes/middleware/ratelimit.js').clientLimiter);

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

app.listen(PORT, err => {
  // express 5 hands a failed listen to this callback instead of crashing. without the throw a second
  // copy of the server kept running with no port and its boot build rewrote the dist the first copy served
  if (err) throw err;
  console.log(`[Server] running on port ${PORT}`);

  // lmao imagine this thing fails
  require('./modules/minify.js').startMinify({
    src: path.join(__dirname, './public'),
    dest: PRODUCTION_PUBLIC_DIRECTORY
  }).then(resolveMinify);
});
