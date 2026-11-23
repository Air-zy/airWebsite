const serverInfo = require('./serverInfo.js');
const { getIP } = require('../ip_utils.js');
const { animate, hex } = require('../cliAnim.js');
const site = require('../../config/site.js');

// powershells curl is Invoke-WebRequest and sends a Mozilla UA, so it misses on purpose
const TERMINAL_UA = /^(curl|wget|httpie|xh|fetch|lwp-request|libwww-perl)/i;

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
const AI_QUIPS = site.aiQuips;

const pick = list => list[Math.floor(Math.random() * list.length)];
const randomQuip = () => pick(QUIPS);
const aiQuip = () => pick(AI_QUIPS);
// motd means message of the DAY, so this one holds still until utc midnight
const quipOfTheDay = () => QUIPS[Math.floor(Date.now() / 86400000) % QUIPS.length];

const CLI_HINT = `  the rest of the site runs in here too
    ${C.cyan}curl airzy.ca/cli${C.off}
`;

// cloudflare's always use https stays off, curl doesn't follow redirects and curl airzy.ca has to work on plain
// http. browsers get sent to https here instead. cf-visitor holds the scheme the visitor used, so no header
// (localhost) never redirects
function httpsUnlessTerminal(req, res, next) {
  const http = (req.headers['cf-visitor'] || '').includes('"http"');
  if (!http || TERMINAL_UA.test(req.headers['user-agent'] || '')) return next();
  res.redirect(301, `https://${req.hostname}${req.originalUrl}`);
}

// Accept text/html is the opt out
function isTerminal(req) {
  return TERMINAL_UA.test(req.headers['user-agent'] || '')
    && !(req.headers.accept || '').includes('text/html');
}

// a crawler that says who it is (compatible;, a bot name, a +http contact). search and link previews need the html
const NAMES_ITSELF = /compatible|bot|\+http/i;

// chrome since 76 and firefox since 90 send Sec-Fetch-Mode on every https request, so a ua that claims one of them and
// leaves it out is a script in a browser's ua (jina, deepseek). plain http (the lan) never sends it, so not judged
const SENDS_SEC_FETCH = { Chrome: 76, Firefox: 90 };
function fakeBrowser(req, ua) {
  const m = ua.match(/(Chrome|Firefox)\/(\d+)/);
  return Boolean(m) && Number(m[2]) >= SENDS_SEC_FETCH[m[1]] && !NAMES_ITSELF.test(ua)
    && req.secure && !req.headers['sec-fetch-mode'];
}

// the fetchers that run when someone asks an ai about a page. the vendors document these names and cloudflare files
// them as AI Assistant. their crawlers (gptbot, claudebot, oai-searchbot, perplexitybot) stay out on purpose, they
// index the homepage and should see the real one
const AI_FETCHER = /\b(chatgpt-user|claude-user|claude-agent|perplexity-user|mistralai-user|duckassistbot|google-agent|googleagent-urlcontext)\b/i;

// no browser asks for markdown, claude code, cursor, opencode and copilot do. chatgpt's agent and manus sign their
// requests (web bot auth) under a plain chrome ua, the signature isn't checked since faking one only buys a quip.
// crawlers can sign too, so one that names itself doesn't count. chatgpt, codex, claude.ai, perplexity and gemini cli
// only say who they are in the ua. a text/html in the accept still counts, an agent asks for html and cannot use it
function isAgent(req) {
  const ua = req.headers['user-agent'] || '';
  return (req.headers.accept || '').includes('text/markdown')
    || (Boolean(req.headers['signature-agent']) && !NAMES_ITSELF.test(ua))
    || AI_FETCHER.test(ua)
    || fakeBrowser(req, ua);
}

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

// only the blank lines go, trim would take the indent with them
const agentCard = req => card(req, aiQuip()).replace(/^\n+|\n+$/g, '');

const middleware = (req, res, next) => {
  // index.html points here with rel=alternate (codex cli follows it) and people never land on it, so it's always the
  // agent card. noindex, it isn't the homepage
  if (req.path === '/index.md') {
    res.set('X-Robots-Tag', 'noindex');
    return res.type('text/markdown; charset=utf-8').send(`${plain(agentCard(req))}\n`);
  }
  if (req.path !== '/' && req.path !== '/home') return next();

  if (isTerminal(req)) return animate(req, res);
  if (isAgent(req)) return text(req, res, agentCard(req));
  next();
};

module.exports = { isTerminal, isAgent, text, card, quipOfTheDay, aiQuip, C, middleware, httpsUnlessTerminal };

// ip_utils drags in firebase, so this needs the env file: node --env-file=.env src/routes/middleware/terminal.js
if (require.main === module) {
  const a = require('assert');
  let sent = '';
  const hit = (ua, accept, { path = '/', secure = true, ...headers } = {}) => {
    let passed = false;
    sent = '';
    middleware(
      { path, secure, query: {}, headers: { 'user-agent': ua, accept, ...headers } },
      { type() { return this; }, set() { return this; }, write() {}, send(s) { sent = s; }, end() {}, on() {} },
      () => (passed = true)
    );
    return !passed;
  };

  a.ok(hit('curl/8.4.0', '*/*'));
  a.ok(hit('Wget/1.21', undefined));
  a.ok(!hit('curl/8.4.0', 'text/html'));                     // opt out
  a.ok(!hit('Mozilla/5.0 (Windows NT 10.0) Chrome', '*/*')); // browser with a weird accept
  a.ok(!hit('curl/8.4.0', '*/*', { path: '/api/logs' }));    // only the homepage
  a.ok(!hit(undefined, undefined));

  const chrome = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36';
  const browser = { 'sec-fetch-mode': 'navigate' };
  a.ok(hit('Claude-User (claude-code/2.1.330; +https://support.anthropic.com/)', 'text/markdown, text/html, */*'));
  a.ok(AI_QUIPS.some(q => sent.includes(q)), 'agents get their own quip');
  a.ok(hit(chrome, 'text/html', { ...browser, 'signature-agent': '"https://chatgpt.com"' }));  // chatgpt's agent
  a.ok(!hit('Mozilla/5.0 (compatible; SomeBot/2.0; +https://example.com/bot)', 'text/html', { 'signature-agent': '"https://example.com"' }));  // a crawler that signs
  a.ok(hit(chrome, '*/*'));                                                   // a script in chrome's ua
  a.ok(hit('Mozilla/5.0 (X11; Linux x86_64; rv:149.0) Gecko/20100101 Firefox/149.0', '*/*'));
  a.ok(!hit(chrome, 'text/html', browser));                                   // a real browser
  a.ok(!hit(chrome, 'text/html', { secure: false }));                         // the lan, no sec-fetch on http
  a.ok(!hit('Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.7390.122 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)', 'text/html'));
  a.ok(!hit('Mozilla/5.0 (Macintosh; Intel Mac OS X 10.10; rv:38.0) Gecko/20100101 Firefox/38.0', '*/*'));  // discord's preview
  a.ok(hit('Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ChatGPT-User/1.0; +https://openai.com/bot', 'text/html'));
  a.ok(hit('GoogleAgent-URLContext', '*/*'));                                 // gemini cli
  // the crawlers index the homepage, so they get it
  a.ok(!hit('Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.4; +https://openai.com/gptbot', 'text/html'));
  a.ok(!hit('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36; compatible; OAI-SearchBot/1.4; +https://openai.com/searchbot', 'text/html'));

  a.ok(hit(undefined, undefined, { path: '/index.md' }));                    // rel=alternate, whoever asks
  a.ok(AI_QUIPS.some(q => sent.includes(q)) && !sent.includes('\x1b'), 'index.md is the agent card, no colours');
  a.strictEqual(plain(`${C.accent}hi${C.off}`), 'hi');

  // plain http is for terminals, browsers go to https with the path and query kept
  const sentTo = (visitor, ua) => {
    let to = null;
    const headers = { 'user-agent': ua };
    if (visitor) headers['cf-visitor'] = `{"scheme":"${visitor}"}`;
    httpsUnlessTerminal({ headers, hostname: 'airzy.ca', originalUrl: '/cli/help?a=1' },
      { redirect: (code, url) => (to = `${code} ${url}`) }, () => {});
    return to;
  };
  a.strictEqual(sentTo('http', 'Mozilla/5.0 (Windows NT 10.0) Chrome/151.0.0.0'), '301 https://airzy.ca/cli/help?a=1');
  a.strictEqual(sentTo('http', 'curl/8.4.0'), null);
  a.strictEqual(sentTo('http', 'Wget/1.21'), null);
  a.strictEqual(sentTo('https', 'Mozilla/5.0 (Windows NT 10.0) Chrome/151.0.0.0'), null);
  a.strictEqual(sentTo(undefined, 'Mozilla/5.0 (Windows NT 10.0) Chrome/151.0.0.0'), null);  // localhost

  // the days quip holds still, the homepage one does not
  a.strictEqual(quipOfTheDay(), quipOfTheDay());
  a.ok(QUIPS.includes(quipOfTheDay()));
  const req = { headers: {} };
  a.ok(card(req).includes('curl airzy.ca/cli'));
  a.ok(!card(req, quipOfTheDay(), '').includes('curl airzy.ca/cli'));

  console.log('terminal ok');
  process.exit(0);
}
