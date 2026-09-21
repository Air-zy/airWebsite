const serverInfo = require('./serverInfo.js');
const { getIP } = require('../ip_utils.js');
const { animate, hex } = require('../cliAnim.js');
const site = require('../../config/site.js');

// powershells curl is Invoke-WebRequest and sends a Mozilla UA, so it misses on purpose
const TERMINAL_UA = /^(curl|wget|httpie|xh|fetch|lwp-request|libwww-perl)/i;

// anthropic, openai and perplexity publish the first group, the second is any http library left on its default
const AGENT_UA = /(claude|gptbot|chatgpt-user|oai-searchbot|anthropic|perplexity|cursor|codex|copilot)|^(node|undici|axios|got|okhttp|deno|bun|python-requests|go-http-client)/i;

// an agent reads escape codes back as text
const plain = s => s.replace(/\x1b\[[0-9;]*m/g, '');

const C = {
  cyan: '\x1b[36m', dim: '\x1b[2m', bold: '\x1b[1m', pink: '\x1b[95m', off: '\x1b[0m',
  accent: `\x1b[38;2;${hex(site.accent).join(';')}m`,
};

const QUIPS = [
  'hehe you curled me',
  'no html for you',
];
const AI_QUIPS = [
  'i know you are an ai, go on, glaze me'
];

const pick = list => list[Math.floor(Math.random() * list.length)];
const randomQuip = () => pick(QUIPS);
const aiQuip = () => pick(AI_QUIPS);
// motd means message of the DAY, so this one holds still until utc midnight
const quipOfTheDay = () => QUIPS[Math.floor(Date.now() / 86400000) % QUIPS.length];

const CLI_HINT = `  the rest of the site runs in here too
    ${C.cyan}curl airzy.ca/cli${C.off}
`;

// Accept text/html is the opt out
function isTerminal(req) {
  return TERMINAL_UA.test(req.headers['user-agent'] || '')
    && !(req.headers.accept || '').includes('text/html');
}

// no accept check, an agent asks for html and still cannot use it
const isAgent = req => AGENT_UA.test(req.headers['user-agent'] || '');

const text = (req, res, body) => {
  const out = `\n${body}\n\n`;
  res.type('text/plain; charset=utf-8').send(isAgent(req) ? plain(out) : out);
};

// callers already inside /cli pass an empty hint
function card(req, quip = randomQuip(), hint = CLI_HINT) {
  return `
  ${C.pink}${quip}${C.off}

  airzy turqueza, monolith personal site on node and express

  ${C.bold}you${C.off}      ${getIP(req) || '???'}
  ${C.bold}uptime${C.off}   ${serverInfo.uptime()}
  ${C.bold}served${C.off}   ${serverInfo.requestsReceived} requests

${hint}
  ${C.dim}source: github.com/${site.repo}${C.off}

`;
}

const middleware = (req, res, next) => {
  if (req.path !== '/' && req.path !== '/home') return next();

  if (isTerminal(req)) return animate(req, res);
  // only the blank lines, trim would take the indent with them
  if (isAgent(req)) return text(req, res, card(req, aiQuip()).replace(/^\n+|\n+$/g, ''));
  next();
};

module.exports = { isTerminal, isAgent, text, card, quipOfTheDay, aiQuip, C, middleware };

// ip_utils drags in firebase, so this needs the env file: node --env-file=.env src/routes/middleware/terminal.js
if (require.main === module) {
  const a = require('assert');
  let sent = '';
  const hit = (ua, accept, path = '/') => {
    let passed = false;
    sent = '';
    middleware(
      { path, query: {}, headers: { 'user-agent': ua, accept } },
      { type() { return this; }, set() { return this; }, write() {}, send(s) { sent = s; }, end() {}, on() {} },
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

  a.ok(hit('Claude-User/1.0; +Anthropic-AI', 'text/html'));
  a.ok(hit('node', '*/*'));
  a.ok(hit('GPTBot/1.2', 'text/html'));
  a.ok(AI_QUIPS.some(q => sent.includes(q)), 'agents get their own quip');
  a.ok(!hit('Mozilla/5.0 (Windows NT 10.0) Chrome/151.0.0.0 Safari/537.36', 'text/html'));  // a real browser
  a.strictEqual(plain(`${C.accent}hi${C.off}`), 'hi');

  // the days quip holds still, the homepage one does not
  a.strictEqual(quipOfTheDay(), quipOfTheDay());
  a.ok(QUIPS.includes(quipOfTheDay()));
  const req = { headers: {} };
  a.ok(card(req).includes('curl airzy.ca/cli'));
  a.ok(!card(req, quipOfTheDay(), '').includes('curl airzy.ca/cli'));

  console.log('terminal ok');
  process.exit(0);
}
