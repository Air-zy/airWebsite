const path = require('path');
const router = require('express').Router();

const PRODUCTION_PUBLIC_DIRECTORY = path.join(__dirname, '../dist');
const page = file => (req, res) => res.sendFile(file, { root: PRODUCTION_PUBLIC_DIRECTORY });

// / and /home are the same page on purpose, same for /change and /coinsort
router.get('/',           page('/index.html'));
router.get('/home',       page('/index.html'));
router.get('/c4',         page('/c4/connect4.html'));
router.get('/roblox',     page('/roblox/roblox.html'));
router.get('/avyTos',     page('/avyTOS.html'));
router.get('/avyprivacy', page('/avyPrivacy.html'));
router.get('/change',     page('/change.html'));
router.get('/quad',       page('/quadratic.html'));
router.get('/coinsort',   page('/change.html'));
router.get('/journal',    page('/journal/journal.html'));
router.get('/deepwoken',  page('/deepwoken.html'));
router.get('/anime',      page('/anime.html'));
router.get('/encryption', page('/encryption/cbc.html'));
router.get('/trafic',     page('/api.html'));
router.get('/anime2',     page('/anime2/main.html'));
router.get('/rowa2',      page('/ROWA/rowa2.html'));

module.exports = router;
