// the only copy of this stuff. cli.js reads the data, minify.js pastes the html into index.html at boot
// change a link or a skill here and nowhere else

const fs = require('fs');
const crypto = require('crypto');

// a short hash of some files in public, for ?v= on their urls
const version = files => files.reduce((h, f) => h.update(fs.readFileSync(__dirname + '/../public/' + f)), crypto.createHash('md5')).digest('hex').slice(0, 8);

const socials = [
  { label: 'GitHub',    icon: 'github',              url: 'https://github.com/Air-zy' },
  { label: 'LinkedIn',  icon: 'linkedin-square',     url: 'https://www.linkedin.com/in/airzy-turqueza-7994762b3/' },
  { label: 'LeetCode',  icon: 'code',                url: 'https://leetcode.com/u/AirzyEz/' },
  { label: 'YouTube',   icon: 'youtube-play',        url: 'https://www.youtube.com/channel/UCgyAZGAZR_knbCnp-bP9wkw' },
  { label: 'Instagram', icon: 'instagram',           url: 'https://www.instagram.com/airzyalt' },
  { label: 'Snapchat',  icon: 'snapchat-ghost',      url: 'https://www.snapchat.com/add/airalternative' },
  { label: 'X',         icon: 'twitter',             url: 'https://x.com/airzyalt' },
];

// to is where a button goes, main.js reads it off data-to. guestbook and contact do more than scroll
const nav = [
  { label: 'home',      href: '/home' },
  { label: 'about',     to: 'about' },
  { label: 'projects',  to: 'projects-section' },
  { label: 'guestbook', to: 'guestbook' },
  { label: 'contact',   to: 'contact' },
];

const about = [
  'studied {software development|tech} at {SAIT|name|https://www.sait.ca}.',
  "i write code and build games when i'm bored.",
  'programming {since 2018|accent}.',
];

const skills = {
  languages: ['C++', 'Java', 'JavaScript', 'TypeScript', 'Luau', 'Python'],
  technologies: ['Node.js', 'Express', 'PostgreSQL', 'React / React Native', 'Docker', 'Kubernetes', 'Azure', 'WebGL'],
  other: ['Hugging Face', 'Roblox Game Development'],
};

// button not div, so the three scroll items take focus and fire on enter/space.
// span not div because a button only takes phrasing content
// symbol ids in icons.svg are i- plus the name
const icon = name => `<svg class="icon" aria-hidden="true"><use href="#i-${name}"/></svg>`;

const navItem = n => n.href
  ? `<a class="nav-item" href="${n.href}">${n.label} <span class="underline"></span></a>`
  : `<button class="nav-item" data-to="${n.to}">${n.label} <span class="underline"></span></button>`;

// {phrase|role} is a phrase the page tints, role is accent, name or tech (.hl- in main.css). {phrase|role|url}
// makes it a link too. no html in the lines, so the cli just drops the braces and has nothing to strip
const colorize = l => l.replace(/\{([^|}]+)\|([^|}]+)(?:\|([^}]+))?\}/g, (_, phrase, role, url) => url
  ? `<a class="hl-${role}" href="${url}" target="_blank">${phrase}</a>`
  : `<span class="hl-${role}">${phrase}</span>`);
const plain = l => l.replace(/\{([^|}]+)\|[^}]+\}/g, '$1');

// the my friends section. the data is in firestore, out of this public repo, and peopleEdit.html changes it:
// { groups: [{ name, note? }], people: [{ name, links: [url, ...], why?, groups: ['team bravo', ...] }] }.
// the groups show in that order, each under a dotted line with its name and note as a // comment. someone shows
// once, under their first group, and the others they're in go in a small "also in" under them. a group nobody has
// first shows nothing. people in no group go first, with no heading. the name links to the first link, and every
// link gets an icon by the site it goes to. why takes the same {phrase|role|url} marks as about, and
// [text](https://...) links.
// /api/people draws it with this when someone opens the section. names and reasons are typed by hand, so the few
// characters that would break the html are escaped first
const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
// after esc, so a quote in the url is already &quot; and can't leave the href
const mdLinks = s => s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
// the icon for a link and what a screen reader calls it, by the site's last two labels so m.youtube.com counts.
// discord gets the speech bubbles, the sprite has no discord logo. anything else is the external link arrow
const SITES = {
  'github.com': ['github', 'github'], 'youtube.com': ['youtube-play', 'youtube'], 'youtu.be': ['youtube-play', 'youtube'],
  'instagram.com': ['instagram', 'instagram'], 'linkedin.com': ['linkedin-square', 'linkedin'], 'x.com': ['twitter', 'x'],
  'twitter.com': ['twitter', 'x'], 'snapchat.com': ['snapchat-ghost', 'snapchat'], 'discord.com': ['comments-o', 'discord'],
  'discord.gg': ['comments-o', 'discord'], 'leetcode.com': ['code', 'leetcode'],
};
const linkSite = url => {
  let host = 'link';
  try { host = new URL(url).hostname.replace(/^www\./, ''); } catch {}
  return SITES[host.split('.').slice(-2).join('.')] || ['external-link', host];
};
const linkIcon = url => {
  const [name, label] = linkSite(url);
  return `<a class="link-icon" href="${esc(url)}" target="_blank" aria-label="${esc(label)}">${icon(name)}</a>`;
};
// "a", "a and b", "a, b and c"
const andList = l => l.length < 2 ? l.join('') : `${l.slice(0, -1).join(', ')} and ${l.at(-1)}`;
const person = p => '<div><dt>' + (p.links[0] ? `<a href="${esc(p.links[0])}" target="_blank">${esc(p.name)}</a>` : esc(p.name))
  + (p.links.length ? `<span class="links">${p.links.map(linkIcon).join('')}</span>` : '') + '</dt>'
  + (p.why ? `<dd>${colorize(mdLinks(esc(p.why)))}</dd>` : '')
  + (p.groups.length > 1 ? `<dd class="also">also in ${andList(p.groups.slice(1).map(esc))}</dd>` : '') + '</div>';
// g is null for the people in no group
const group = (g, list) => !list.length ? '' : '<div class="group">'
  + (g ? `<h3><span aria-hidden="true">// </span>${esc(g.name)}${g.note ? `, ${esc(g.note)}` : ''}</h3>` : '')
  + `<dl>${list.map(person).join('')}</dl></div>`;
const peopleList = ({ groups = [], people = [] } = {}) => {
  const all = people.map(p => ({ ...p, links: p.links ?? [], groups: p.groups ?? [] }));
  return group(null, all.filter(p => !p.groups.length)) + groups.map(g => group(g, all.filter(p => p.groups[0] === g.name))).join('');
};

const skillGroup = ([name, items]) => `<div><h3>${name}</h3><ul>${items.map(i => `<li>${i}</li>`).join('')}</ul></div>`;

module.exports = {
  socials,
  repo: 'Air-zy/airWebsite',
  accent: '#cebe78',   // the terminal headings and the animation pane
  about: about.map(plain),
  // draws the my friends list for /api/people
  peopleList,
  skills,

  // the shapes index.html asks for by name, see the <!--#token--> comments in it.
  // the icons are inline with no margin, so the space between them is the gap. keep the join(' ')
  html: {
    socialLinks: socials
      .map(s => `<a href="${s.url}" target="_blank">${icon(s.icon)}${s.label}</a>`).join(' '),

    skills: Object.entries(skills).map(skillGroup).join(''),

    nav: nav.map(navItem).join(' '),
    sideNav: nav.map(navItem).join(' '),

    // inlined so the icons cost no request, replaces 108kb of cdn font awesome
    icons: fs.readFileSync(__dirname + '/icons.svg', 'utf8').trim(),

    about: about.map(l => `<p>${colorize(l)}</p>`).join(''),

    // built once at boot, a server left running over new years eve keeps the old year until it restarts
    copyright: `© ${new Date().getFullYear()} Airzy`,

    // ?v for main.css, main.js, dither.js, r6.js and og.png, only changes when one of them does.
    // cloudflare holds js for 4h whatever we send, so a page and an older r6.js can meet.
    // link previews cache og.png by url, so a new one needs a new ?v too
    v: version(['css/main.css', 'js/main.js', 'js/dither.js', 'ROWA/r6.js', 'og.png']),
    // the 🤓 easter egg's own, so changing it doesn't make everyone download the rest again
    vBreak: version(['js/breakdown.js']),
    // /roblox's own css and js. the page loads home's main.css and dither.js too, with v
    vRoblox: version(['roblox/roblox.css', 'roblox/roblox.js', 'roblox/figure.worker.js', 'roblox/figure/rig.json']),
    // the chess page's (chess.html loads analysis.js with it, analysis.js passes it on to the workers, the opening book
    // and the sounds). the engines' wasm stays out, a new cynical would make everyone download its 43 MB with a new
    // page, and the files the workers load by name (chess.js, rules.js, verityb.js) can't carry it
    vChess: version(['chess/analysis.js', 'chess/engines/engine.worker.js', 'chess/engines/verity/verityb.worker.js', 'chess/openings.tsv',
      ...fs.readdirSync(__dirname + '/../public/chess/sounds').sort().map(f => 'chess/sounds/' + f)]),
    // each engine's build, folder:hash with a space between, on the chess page's engine picker. the page keeps a wasm
    // in its cache storage under its hash, so a new build is the only download (analysis.js)
    vWasm: fs.readdirSync(__dirname + '/../public/chess/engines', { withFileTypes: true })
      .filter(d => d.isDirectory() && fs.existsSync(`${__dirname}/../public/chess/engines/${d.name}/chess.wasm`))
      .map(d => `${d.name}:${version([`chess/engines/${d.name}/chess.wasm`])}`).join(' '),
  },
};

// node src/config/site.js
if (require.main === module) {
  const a = require('assert');
  const html = fs.readFileSync(__dirname + '/../public/index.html', 'utf8');
  const chess = fs.readFileSync(__dirname + '/../public/chess.html', 'utf8');
  const roblox = fs.readFileSync(__dirname + '/../public/roblox/roblox.html', 'utf8');

  // every token a page asks for has to exist here, and every shape has to be used by one of them
  const used = [...(html + chess + roblox).matchAll(/<!--#(\w+)-->/g)].map(m => m[1]);
  a.ok(used.length, 'index.html lost its tokens');
  a.ok(chess.includes('analysis.js?v=<!--#vChess-->'), 'the chess page loads its script versioned');
  // static sees the roblox folder before pagesRouter does, so /roblox 301s to /roblox/. a ./ path there only works because
  // of that, absolute ones work at either
  for (const m of roblox.matchAll(/(?:href|src)="([^"]+)"/g)) a.ok(!m[1].startsWith('.'), `relative path ${m[1]} in roblox.html`);
  for (const f of ['/css/main.css?v=<!--#v-->', '/roblox/roblox.css?v=<!--#vRoblox-->', '/roblox/roblox.js?v=<!--#vRoblox-->'])
    a.ok(roblox.includes(f), `roblox.html loads ${f}`);
  for (const m of roblox.matchAll(/#i-([a-z0-9-]+)/g)) a.ok(module.exports.html.icons.includes(`id="${m[0].slice(1)}"`), `sprite lost ${m[1]}`);
  for (const k of used) a.ok(k in module.exports.html, `no such token ${k}`);
  for (const k of Object.keys(module.exports.html)) a.ok(used.includes(k), `${k} is dead`);

  // the links have to survive the round trip, this is the whole point
  for (const s of socials) a.ok(module.exports.html.socialLinks.includes(s.label));
  a.ok(module.exports.html.skills.includes('<li>Luau</li>'));
  a.ok(module.exports.html.skills.includes('<h3>other</h3>'));
  for (const n of nav) a.ok(module.exports.html.sideNav.includes(n.label));
  for (const n of nav) a.ok(module.exports.html.nav.includes(n.label), n.label);
  a.ok(module.exports.html.nav.includes('<button class="nav-item"'), 'the click items have to be buttons');
  a.ok(!module.exports.html.nav.includes('<div class="nav-item"'), 'a div is not keyboard reachable');
  a.ok(module.exports.html.copyright.includes(String(new Date().getFullYear())));
  a.ok(!module.exports.about.join(' ').match(/[{}|<>]/), 'braces or tags leaked into the cli text');
  a.ok(module.exports.html.about.includes('<span class="hl-tech">software development</span>'));
  a.ok(module.exports.html.about.includes('<a class="hl-name" href="https://www.sait.ca" target="_blank">SAIT</a>'), 'the url part makes a link');
  for (const m of about.join('').matchAll(/\{[^|}]+\|([^|}]+)/g)) a.ok(['accent', 'name', 'tech'].includes(m[1]), `no .hl-${m[1]} role`);
  for (const s of socials) a.ok(module.exports.html.icons.includes(`id="i-${s.icon}"`), `sprite lost ${s.icon}`);
  for (const m of html.matchAll(/#i-([a-z0-9-]+)/g)) a.ok(module.exports.html.icons.includes(`id="${m[0].slice(1)}"`), `sprite lost ${m[1]}`);
  a.ok(module.exports.html.icons.includes('display:none'), 'hidden does nothing on an svg, without display none the sprite renders 300x150');
  a.ok(!html.includes('font-awesome'), 'the sprite replaced font awesome, the cdn link stays gone');
  a.ok(html.includes('id="adapt"'), 'main.js animates this one, it stays in the page');

  // my friends: the name links to the first link only when there is one, the reason only when there is one
  a.strictEqual(peopleList({ groups: [], people: [] }), '');
  a.strictEqual(peopleList(), '');
  const two = peopleList({ groups: [], people: [
    { name: 'a<b', links: ['https://x.y/?a=1&b=2'], why: 'made {this|accent}', groups: [] }, { name: 'c', links: [], groups: [] }] });
  a.ok(two.includes('<a href="https://x.y/?a=1&amp;b=2" target="_blank">a&lt;b</a>'), 'linked and escaped');
  a.ok(two.includes('<dd>made <span class="hl-accent">this</span></dd>'), 'the reason takes the about marks');
  a.ok(two.includes('<div><dt>c</dt></div>'), 'no link is a plain name with no icons, and no reason is no dd');
  a.ok(two.startsWith('<div class="group"><dl>'), 'people in no group still get a group, with no heading');
  a.ok(!two.includes('<h3'), 'no groups, no headings');

  // every link is an icon by site, markdown links work in the reason, and a quote can't leave an href
  const links = peopleList({ groups: [], people: [{ name: 'n', links: ['https://n.dev', 'https://github.com/n', 'https://m.youtube.com/@n',
    'https://yotta.onrender.com/"x'], why: 'a [PTCG champion](https://limitlesstcg.com/players/1?a=1&b=2) and [no](javascript:alert(1))', groups: [] }] });
  a.ok(links.includes('<dt><a href="https://n.dev" target="_blank">n</a><span class="links"><a class="link-icon" href="https://n.dev" target="_blank" aria-label="n.dev">'));
  a.ok(links.includes('<a class="link-icon" href="https://github.com/n" target="_blank" aria-label="github">'));
  a.ok(links.includes('aria-label="youtube"><svg class="icon" aria-hidden="true"><use href="#i-youtube-play"/>'), 'subdomains count');
  a.ok(links.includes('href="https://yotta.onrender.com/&quot;x" target="_blank" aria-label="yotta.onrender.com"><svg class="icon" aria-hidden="true"><use href="#i-external-link"/>'));
  a.ok(links.includes('a <a href="https://limitlesstcg.com/players/1?a=1&amp;b=2" target="_blank">PTCG champion</a>'), 'markdown link');
  a.ok(links.includes('[no](javascript:alert(1))'), 'only http and https become links');
  for (const [n] of [...Object.values(SITES), linkSite('https://n.dev')]) a.ok(module.exports.html.icons.includes(`id="i-${n}"`), `sprite lost ${n}`);

  // once, under the first group, with the others in an also in. loose people first with no heading, the note after
  // the group's name, and a group nobody has first draws nothing
  const grouped = peopleList({ groups: [{ name: 'SAIT' }, { name: 'team bravo', note: 'our <team>' }, { name: 'online' }, { name: 'empty' }], people: [
    { name: 'nick', links: [], groups: ['SAIT'] },
    { name: 'kate / utsanakorn', links: [], groups: ['team bravo', 'online', 'SAIT'] },
    { name: 'loose', links: [], groups: [] },
  ] });
  a.ok(grouped.startsWith('<div class="group"><dl><div><dt>loose</dt></div></dl></div><div class="group"><h3><span aria-hidden="true">// </span>SAIT</h3><dl><div><dt>nick</dt></div></dl></div>'), grouped);
  a.ok(grouped.includes('<h3><span aria-hidden="true">// </span>team bravo, our &lt;team&gt;</h3><dl><div><dt>kate / utsanakorn</dt><dd class="also">also in online and SAIT</dd></div>'), 'note and also in');
  a.strictEqual(grouped.match(/kate \/ utsanakorn/g).length, 1, 'nobody shows twice');
  a.ok(!grouped.includes('empty') && !grouped.includes('// </span>online'), 'a group nobody has first has no heading');
  a.strictEqual(andList(['a', 'b', 'c']), 'a, b and c');
  a.strictEqual(andList(['a']), 'a');

  // peopleEdit.html keeps its own copy of all this for its preview, it has to draw the same html
  const edit = fs.readFileSync(__dirname + '/../public/peopleEdit.html', 'utf8');
  const copy = edit.slice(edit.indexOf('// mirrors the my friends part'), edit.indexOf('// end of the copy'));
  a.ok(copy.includes('const peopleList'), 'the preview copy moved, the slice above needs new ends');
  const editList = require('vm').runInNewContext(copy + ';peopleList', { URL });
  const samples = [
    { groups: [], people: [{ name: 'a<b', links: ['https://x.y/?a=1&b=2'], why: 'made {this|accent}', groups: [] }, { name: 'c', links: [], groups: [] }] },
    { groups: [], people: [{ name: 'n', links: ['https://n.dev', 'https://github.com/n', 'https://yotta.onrender.com/"x'], why: 'a [b](https://c.d)', groups: [] }] },
    { groups: [{ name: 'SAIT' }, { name: 'team bravo', note: 'our team' }, { name: 'empty' }], people: [{ name: 'kate / u', links: [], groups: ['team bravo', 'SAIT'] }, { name: 'loose', links: [], groups: [] }] },
  ];
  for (const s of samples) a.strictEqual(editList(s), peopleList(s), 'peopleEdit.html drifted from site.js');

  console.log('site ok');
}
