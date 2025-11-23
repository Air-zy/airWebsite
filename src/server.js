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

const { startMinify } = require('./modules/minify.js');
startMinify({
  src: path.join(__dirname, './public'),
  dest: PRODUCTION_PUBLIC_DIRECTORY
});

// init
const { startCycler } = require('./heartSystem/heart.js');
startCycler();

const { loadAddresses } = require('./classes/addressRegistry/addressManager.js') // getAddressMap
loadAddresses();

app.use(require('./middleware/ratelimit.js'));
app.use(require('./reqLogger.js'));
//app.use(express.json({ limit: '4mb' })); if the anime map too big bruh
app.use(express.json());

const compression = require('compression');
app.use(compression({ threshold: 1024 })); // 1kb threshold

app.use(express.static(PRODUCTION_PUBLIC_DIRECTORY));
app.use('/api/rowadb', require('./middleware/rowadb_middlware.js'))

// routes 
app.get('/home',       (req, res) => { return res.redirect('/index.html');            });
app.get('/c4',         (req, res) => { return res.redirect('/c4/connect4.html');      });
app.get('/avyTos',     (req, res) => { return res.redirect('/avyTOS.html');           });
app.get('/avyprivacy', (req, res) => { return res.redirect('/avyPrivacy.html');       });
app.get('/change',     (req, res) => { return res.redirect('/change.html');           });
app.get('/quad',       (req, res) => { return res.redirect('/quadratic.html');        });
app.get('/coinsort',   (req, res) => { return res.redirect('/change.html');           });
app.get('/journal',    (req, res) => { return res.redirect('/journal/journal.html');  });
app.get('/deepwoken',  (req, res) => { return res.redirect('/deepwoken.html');        });
app.get('/anime',      (req, res) => { return res.redirect('/anime.html');            });
app.get('/encryption', (req, res) => { return res.redirect('/encryption/cbc.html');   });
app.get('/trafic',     (req, res) => { return res.redirect('/api.html');              });
app.get('/anime2',     (req, res) => { return res.redirect('/anime2/main.html');      });

const apiRoutes = require('./routes/api/apiRouter.js');
app.use('/api', apiRoutes);

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


const { firedbActivityGet, firedbActivitySet } = require('./firebasedb.js')

function newDateStr() {
  let newDateStr = new Date().toISOString()
  return newDateStr;
}

let currentStatus = {
  "status": "",
  "lastOn": newDateStr()
}

let lastUpdate2 = 0;
async function commitCurrentStatus() {
  const now = Date.now();
  if (now > lastUpdate2 + 6000 && currentStatus.status != "" && currentStatus.status) {
    lastUpdate2 = now;
    firedbActivitySet(currentStatus)
  }
}

async function initStatus() {
  const meActivityGet = await firedbActivityGet()
  currentStatus = meActivityGet;
}
initStatus();

const envDecrypt = require('./FallbackEncryption/envDecrypt.js');
const airWebToken = envDecrypt(process.env.airKey, process.env.airWebToken)
app.post('/presence', (req, res) => {
  const authHeader = req.headers['authorization'];

  if (!authHeader) {
    return res.status(401).json({ error: 'Authorization header missing' });
  }

  const token = authHeader.split(' ')[1];
  if (token == airWebToken) {
    const status = req.body.status;
    if (status == "offline") {
      currentStatus.status = status;
      broadcast();
      
      commitCurrentStatus();
    } else if (status == "online") {
      currentStatus.status = status;
      currentStatus.lastOn = newDateStr();
      broadcast();
      
      commitCurrentStatus();
    } else if (status == "dnd") {
      currentStatus.status = status;
      currentStatus.lastOn = newDateStr();
      broadcast();
      
      commitCurrentStatus();
    } else if (status == "idle") {
      currentStatus.status = status;
      currentStatus.lastOn = newDateStr();
      broadcast();
      
      commitCurrentStatus();
    }
  } else {
    return res.status(403).json({ error: 'Invalid password' });
  }
  
  res.sendStatus(200);
})

const http = require('http')
const WebSocket = require('ws');
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
console.log("wws:",wss)

wss.on('error', (err) => {
  console.error("WSS ERROR:", err);
});

wss.on('listening', () => {
  console.log('WSS listening!');
});

wss.on('connection', ws => {
  console.log("WS client connected", currentStatus);
  ws.send(JSON.stringify(currentStatus));
  ws.on('close', () => {
    console.log("WS client disconnected");
  });
});

const broadcast = () => {
  const msg = JSON.stringify(currentStatus);
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  });
};

app.use((req, res) => {
  res.status(404).type('text').send(`Not found LOL 🥀💔 ${req.method} ${req.originalUrl}`);
});


function toBase64(num) {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32BE(num);
  return buffer.toString("base64");
}

const { hashDirectory } = require('./modules/hashDirectory.js');
app.listen(PORT, () => {
  const hash = hashDirectory(__dirname);
  console.log(`Server running on port ${PORT}, Hash ${toBase64(hash)}`);
});


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