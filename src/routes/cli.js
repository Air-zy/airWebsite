const path = require('path');
const router = require('express').Router();

const { isTerminal, isAgent, text, card, quipOfTheDay, aiQuip, C } = require('./middleware/terminal.js');
const { getProjects, getIP } = require('./ip_utils.js');
const { getLastOnline } = require('../modules/myStatus/myStatus.js');
const serverInfo = require('./middleware/serverInfo.js');
const site = require('../config/site.js');

// pagesRouter already holds the page list, read it back instead of keeping a second copy
const PAGES = require('./pagesRouter.js').stack.map(l => l.route?.path).filter(Boolean);

const bullet = (k, v) => `  ${C.bold}${k.padEnd(14)}${C.off}${v}`;
const heading = t => `${C.accent}${t}${C.off}\n`;

// project text lines carry [label]("url") markup, flatten it for a terminal
const unlink = s => s.replace(/\[([^\]]+)\]\("([^"]+)"\)/g, '$1 ($2)');

const ago = iso => {
  const m = Math.floor((Date.now() - Date.parse(iso)) / 60000);
  const [n, unit] = m < 60 ? [m, 'min'] : m < 1440 ? [Math.floor(m / 60), 'hour'] : [Math.floor(m / 1440), 'day'];
  return `${n} ${unit}${n === 1 ? '' : 's'} ago`;
};

// github allows 60 anonymous calls an hour, so the answer is held for ten minutes
let commit = null, commitAt = 0;
async function lastCommit() {
  if (commit && Date.now() - commitAt < 600000) return commit;
  try {
    const res = await fetch(`https://api.github.com/repos/${site.repo}/commits?per_page=1`,
      { headers: { 'User-Agent': 'airzy.ca' } });
    const [c] = await res.json();
    commit = `${c.commit.message.split('\n')[0]}  ${C.dim}${site.repo.split('/')[1]}, ${ago(c.commit.author.date)}${C.off}`;
  } catch (e) {
    console.error('[cli] github:', e.message);
  }
  commitAt = Date.now();
  return commit;
}

const CMDS = {
  help: () => heading('commands') + Object.keys(CMDS).map(c => `  ${c}`).join('\n')
    + `\n\n  ${C.dim}curl airzy.ca/cli/<command>${C.off}`
    + `\n  ${C.dim}curl airzy.ca  the animation, pick one with ?a=rain${C.off}`,

  about: () => heading('about')
    + ['  airzy turqueza, software developer', '', ...site.about.map(l => '  ' + l)].join('\n'),

  skills: () => heading('skills')
    + Object.entries(site.skills).map(([k, v]) => bullet(k.toLowerCase(), v.join(', '))).join('\n'),

  projects: () => {
    const projects = getProjects();
    if (!projects) return 'projects are still loading, try again in a second';

    // same ranking the homepage uses, views weighted by rank
    return heading('projects') + Object.values(projects)
      .sort((a, b) => b.stats.views / b.rank - a.stats.views / a.rank)
      .map(p => [
        `  ${C.bold}${p.title}${C.off} ${C.dim}${p.stats.views} views${C.off}`,
        `  ${C.cyan}${p.url}${C.off}`,
        ...p.text.map(l => `    ${unlink(l)}`),
        `    ${C.dim}${p.tags.join('  ')}${C.off}`,
      ].join('\n')).join('\n\n');
  },

  pages: () => heading('pages') + PAGES.map(p => `  airzy.ca${p}`).join('\n'),

  socials: () => heading('socials')
    + site.socials.map(x => bullet(x.label.toLowerCase(), x.url)).join('\n'),

  status: async req => {
    const last = await getLastOnline();
    return heading('status') + [
      bullet('you', getIP(req) || '???'),
      bullet('last online', last ? ago(last.lastOn) : 'unknown'),
      bullet('last commit', await lastCommit() || 'unknown'),
      bullet('uptime', serverInfo.uptime()),
      bullet('served', `${serverInfo.requestsReceived} requests`),
    ].join('\n');
  },

  // email, discord and location sit behind the human check in validate_me.js. not leaking them to a script
  contact: () => heading('contact') + [
    '  the real address is behind a human check, open airzy.ca in a browser for it',
    '',
    bullet('fallback', 'AirzyAlt@gmail.com'),
  ].join('\n'),

  neofetch: req => card(req),

  motd: req => card(req, quipOfTheDay(), '') + CMDS.help(),
};

CMDS.ls = CMDS.pages;
CMDS.whoami = CMDS.about;
CMDS.links = CMDS.socials;

async function run(name, req) {
  const cmd = CMDS[name];
  if (!cmd) return `${name}: not a command. try help`;
  return cmd(req);
}

router.get('/', async (req, res) => {
  if (isTerminal(req) || isAgent(req)) {
    // an agent gets greeted here too, colours would be stripped for it anyway
    const quip = isAgent(req) ? `  ${aiQuip()}\n\n` : '';
    return text(req, res, `${quip}${await CMDS.status(req)}\n\n${CMDS.help()}`);
  }
  res.sendFile('/cli.html', { root: path.join(__dirname, '../dist') }); // browsers get a terminal to type in
});

// cliart.html seeds from this, so it always shows what is really shipped
router.get('/art.png', (req, res) =>
  res.sendFile('cliart.png', { root: path.join(__dirname, '../config') }));

router.get('/:cmd', async (req, res) => text(req, res, await run(req.params.cmd, req)));

module.exports = router;

// node --env-file=.env src/routes/cli.js
if (require.main === module) {
  const a = require('assert');
  const req = { headers: {} };

  a.ok(PAGES.includes('/') && PAGES.includes('/rowa2'));           // pagesRouter introspection still works
  a.ok(CMDS.help().includes('projects'));
  a.ok(CMDS.pages().includes('airzy.ca/c4'));
  a.match(unlink('see [my repo]("https://x.y")'), /my repo \(https:\/\/x\.y\)/);
  a.ok(CMDS.neofetch(req).includes('airzy turqueza'));

  const iso = mins => new Date(Date.now() - mins * 60000).toISOString();
  a.strictEqual(ago(iso(5)), '5 mins ago');
  a.strictEqual(ago(iso(60)), '1 hour ago');
  a.strictEqual(ago(iso(3000)), '2 days ago');

  run('nonsense', req).then(out => {
    a.match(out, /not a command/);
    return CMDS.status(req);
  }).then(out => {
    a.ok(out.includes('you') && out.includes('served'));         // the stats moved here off /
    console.log('cli ok');
    process.exit(0);
  });
}
