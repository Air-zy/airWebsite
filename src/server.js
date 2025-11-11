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

const { loadAddresses } = require('./addressRegistry/addressManager.js') // getAddressMap
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

app.get('/api/rowa/fights/recent',  require('./routes/rowa2/getFightsRecent.js')   );
app.get('/api/rowa/fights/:id',     require('./routes/rowa2/getFightById.js')      );
app.get('/api/rowa/fights',         require('./routes/rowa2/rowa_all_fights.js')   );
app.get('/api/rowa/:userid',        require('./routes/rowa2/plrData.js')           );
app.get('/api/anime2/data',         require('./routes/anime2/data.js')             );
app.get('/api/rblx',                require('./routes/api_rblx.js')                );
app.get('/api/logs',                require('./routes/api_logs.js')                );
app.get('/api/projects',            require('./routes/api_projects.js')            );
app.get('/api/headers',             require('./routes/api_headers.js')             );
app.get('/api/cluster-units',       require('./routes/api_clusterUnits.js')        );
app.get('/info',                    require('./routes/info.js')                    );
app.get('/r',                       require('./routes/r.js')                       ); // request token

app.post('/webhook',                require('./routes/webhooks/webhook.js')        );
app.post('/webhook2',               require('./routes/webhooks/webhook2.js')       );

app.post('/c',                      require('./routes/c.js')                       );
app.post('/validate-me',            require('./routes/validate_me.js')             );
app.post('/api/project-edit',       require('./routes/api_project_edit.js')        );
app.post('/api/get-anime',          require('./routes/anime/get_anime.js')         );
app.post('/api/commit-anime',       require('./routes/anime/commit_anime.js')      );
app.post('/api/projects-update',    require('./routes/projects_update.js')         );

app.post('/api/rowadb/fights',      require('./routes/rowa2/rowa_fights.js')       );
app.post('/nfetch',                 require('./routes/nfetch.js')                  );
 

const { startrbx } = require('./routes/rblxapp/robloxstuff.js')
startrbx(app)

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