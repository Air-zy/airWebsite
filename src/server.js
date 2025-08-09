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

const { startMinify } = require('./minify.js');
startMinify({
  src: path.join(__dirname, './public'),
  dest: PRODUCTION_PUBLIC_DIRECTORY
});



// init
const { startCycler } = require('./heartSystem/heart.js');
startCycler();

const { loadAddresses } = require('./addressRegistry/addressManager.js')
loadAddresses();


const compression = require('compression');
app.use(require('./reqLogger.js'));
//app.use(express.json({ limit: '4mb' })); if the anime map too big bruh
app.use(express.json());
app.use(compression({ threshold: 1024 })); // 1kb threshold
app.use(express.static(PRODUCTION_PUBLIC_DIRECTORY));

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

app.get('/api/logs',                require('./routes/api_logs.js')                );
app.get('/api/projects',            require('./routes/api_projects.js')            );
app.get('/api/headers',             require('./routes/api_headers.js')             );
app.get('/info',                    require('./routes/info.js')                    );
app.get('/api/cluster-units',       require('./routes/api_clusterUnits.js')        );
app.get('/r',                       require('./routes/r.js')                       ); // request token

app.post('/webhook',                require('./routes/webhook.js')                 );

app.post('/c',                      require('./routes/c.js')                       );
app.post('/validate-me',            require('./routes/validate_me.js')             );
app.post('/api/project-edit',       require('./routes/api_project_edit.js')        );
app.post('/api/get-anime',          require('./routes/anime/get_anime.js')               );
app.post('/api/commit-anime',       require('./routes/anime/commit_anime.js')            );
app.post('/api/projects-update',    require('./routes/projects_update.js')         );

const { startrbx } = require('./routes/rblxapp/robloxstuff.js')
startrbx(app)

app.use((req, res) => {
  res.status(404).send(`Not found LOL 🥀💔 ${req.method} ${req.originalUrl}`);
});





function toBase64(num) {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32BE(num);
  return buffer.toString("base64");
}

const { hashDirectory } = require('./hashDirectory.js');
app.listen(PORT, () => {
  const hash = hashDirectory(__dirname);
  console.log(`Server running on port ${PORT}, Hash ${toBase64(hash)}`);
});