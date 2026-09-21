const serverInfo = require('./serverInfo.js');
const { getIP } = require('../ip_utils.js');

// curl, wget and friends. powershells curl is Invoke-WebRequest and sends a Mozilla UA, so it misses on purpose
const TERMINAL_UA = /^(curl|wget|httpie|xh|fetch|lwp-request|libwww-perl|python-requests|go-http-client)/i;

const C = { cyan: '\x1b[36m', dim: '\x1b[2m', bold: '\x1b[1m', pink: '\x1b[95m', off: '\x1b[0m' };

const BANNER = [
  "        _                   ",
  "  __ _ (_) _ __  ____ _   _ ",
  " / _` || || '__||_  /| | | |",
  "| (_| || || |    / / | |_| |",
  " \\__,_||_||_|   /___| \\__, |",
  "                       |___/ ",
].join('\n');

const QUIPS = [
  'hehe you curled me',
  'no html for you',
  'html is upstairs, this is the basement',
  'you asked for a website and got a text file',
  'ratio + you use a terminal + based',
  'zero javascript, zero cookies, zero fun',
  'this site renders at 80 columns and i am not sorry',
  'somewhere a designer is crying',
  'you could have just clicked a link',
  'loads faster than the real one',
];

const randomQuip = () => QUIPS[Math.floor(Math.random() * QUIPS.length)];
// motd means message of the DAY, so this one holds still until utc midnight
const quipOfTheDay = () => QUIPS[Math.floor(Date.now() / 86400000) % QUIPS.length];

const CLI_HINT = `  the rest of the site runs in here too
    ${C.cyan}curl airzy.ca/cli${C.off}
`;

const pad = n => String(n).padStart(2, '0');
function uptime() {
  const s = Math.floor(process.uptime());
  return `${Math.floor(s / 3600)}h ${pad(Math.floor(s / 60) % 60)}m ${pad(s % 60)}s`;
}

// a shell asked for this, not a browser. Accept text/html is the opt out
function isTerminal(req) {
  return TERMINAL_UA.test(req.headers['user-agent'] || '')
    && !(req.headers.accept || '').includes('text/html');
}

// hint is empty when the caller is already inside /cli, nothing to point at from there
function card(req, quip = randomQuip(), hint = CLI_HINT) {
  return `
${C.cyan}${BANNER}${C.off}
  ${C.pink}${quip}${C.off}

  airzy turqueza, monolith personal site on node and express

  ${C.bold}you${C.off}      ${getIP(req) || '???'}
  ${C.bold}uptime${C.off}   ${uptime()}
  ${C.bold}served${C.off}   ${serverInfo.requestsReceived} requests

${hint}
  ${C.dim}source: github.com/Air-zy/airWebsite${C.off}

`;
}

// / and /home only, every other route stays machine readable
const middleware = (req, res, next) => {
  if (req.path !== '/' && req.path !== '/home') return next();
  if (!isTerminal(req)) return next();

  res.type('text/plain; charset=utf-8').send(card(req));
};

module.exports = { isTerminal, card, uptime, quipOfTheDay, C, middleware };

// ip_utils drags in firebase, so this needs the env file: node --env-file=.env src/routes/middleware/terminal.js
if (require.main === module) {
  const a = require('assert');
  const hit = (ua, accept, path = '/') => {
    let passed = false;
    middleware(
      { path, headers: { 'user-agent': ua, accept } },
      { type() { return this; }, send() {} },
      () => (passed = true)
    );
    return !passed;
  };

  a.ok(hit('curl/8.4.0', '*/*'));
  a.ok(hit('Wget/1.21', undefined));
  a.ok(!hit('curl/8.4.0', 'text/html'));                     // opt out
  a.ok(!hit('Mozilla/5.0 (Windows NT 10.0) Chrome', '*/*')); // browser with a weird accept
  a.ok(!hit('curl/8.4.0', '*/*', '/api/logs'));              // only the homepage
  a.ok(!hit(undefined, undefined));

  // the days quip holds still, the homepage one does not
  a.strictEqual(quipOfTheDay(), quipOfTheDay());
  a.ok(QUIPS.includes(quipOfTheDay()));
  const req = { headers: {} };
  a.ok(card(req).includes('curl airzy.ca/cli'));
  a.ok(!card(req, quipOfTheDay(), '').includes('curl airzy.ca/cli'));

  console.log('terminal ok');
  process.exit(0);
}
