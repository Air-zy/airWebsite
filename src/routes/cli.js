const path = require('path');
const router = require('express').Router();

const { isTerminal, card, uptime, quipOfTheDay, C } = require('./middleware/terminal.js');
const { getProjects } = require('./ip_utils.js');
const { getStatus } = require('../heartSystem/heart.js');
const { getLastOnline } = require('../modules/myStatus/myStatus.js');
const site = require('../config/site.js');

// the page list is already declared once, in pagesRouter. read it back instead of keeping a second copy
const PAGES = require('./pagesRouter.js').stack.map(l => l.route?.path).filter(Boolean);

const bullet = (k, v) => `  ${C.bold}${k.padEnd(14)}${C.off}${v}`;
const heading = t => `${C.cyan}${t}${C.off}\n`;

// project text lines carry [label]("url") markup, flatten it for a terminal
const unlink = s => s.replace(/\[([^\]]+)\]\("([^"]+)"\)/g, '$1 ($2)');

const CMDS = {
  help: () => heading('commands') + Object.keys(CMDS).map(c => `  ${c}`).join('\n')
    + `\n\n  ${C.dim}curl airzy.ca/cli/<command>${C.off}`,

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

  status: async () => {
    const last = await getLastOnline();
    const heart = getStatus();
    return heading('status') + [
      bullet('last online', last ? `${last.minsAgo} mins ago` : 'unknown'),
      bullet('uptime', uptime()),
      bullet('heartbeat', `${heart.success}/${heart.total} ok${heart.lastError ? `, last error: ${heart.lastError}` : ''}`),
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

router.get('/', (req, res) => {
  if (isTerminal(req)) return res.type('text/plain; charset=utf-8').send(`\n${CMDS.motd(req)}\n\n`);
  res.sendFile('/cli.html', { root: path.join(__dirname, '../dist') }); // browsers get a terminal to type in
});

router.get('/:cmd', async (req, res) =>
  res.type('text/plain; charset=utf-8').send(`\n${await run(req.params.cmd, req)}\n\n`));

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

  run('nonsense', req).then(out => {
    a.match(out, /not a command/);
    console.log('cli ok');
    process.exit(0);
  });
}
