// the only copy of this stuff. cli.js reads the data, minify.js pastes the html into index.html at boot
// change a link or a skill here and nowhere else

const fs = require('fs');
const crypto = require('crypto');

const socials = [
  { label: 'GitHub',    icon: 'github',              url: 'https://github.com/Air-zy' },
  { label: 'LinkedIn',  icon: 'linkedin-square',     url: 'https://www.linkedin.com/in/airzy-turqueza-7994762b3/' },
  { label: 'LeetCode',  icon: 'code',                url: 'https://leetcode.com/u/AirzyEz/' },
  { label: 'YouTube',   icon: 'youtube-play',        url: 'https://www.youtube.com/channel/UCgyAZGAZR_knbCnp-bP9wkw' },
  { label: 'Instagram', icon: 'instagram',           url: 'https://www.instagram.com/airzyalt' },
  { label: 'Snapchat',  icon: 'snapchat-ghost',      url: 'https://www.snapchat.com/add/airalternative' },
  { label: 'X',         icon: 'twitter',             url: 'https://x.com/airzyalt' },
];

const nav = [
  { label: 'home',      href: '/home' },
  { label: 'about',     click: "goTo('about')" },
  { label: 'projects',  click: "goTo('projects-section')" },
  { label: 'guestbook', click: 'toGuestbook()' },
  { label: 'contact',   click: 'toContact()' },
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
  : `<button class="nav-item" onclick="${n.click}">${n.label} <span class="underline"></span></button>`;

// {phrase|role} is a phrase the page tints, role is accent, name or tech (.hl- in main.css). {phrase|role|url}
// makes it a link too. no html in the lines, so the cli just drops the braces and has nothing to strip
const colorize = l => l.replace(/\{([^|}]+)\|([^|}]+)(?:\|([^}]+))?\}/g, (_, phrase, role, url) => url
  ? `<a class="hl-${role}" href="${url}" target="_blank">${phrase}</a>`
  : `<span class="hl-${role}">${phrase}</span>`);
const plain = l => l.replace(/\{([^|}]+)\|[^}]+\}/g, '$1');

const skillGroup = ([name, items]) => `<div><h3>${name}</h3><ul>${items.map(i => `<li>${i}</li>`).join('')}</ul></div>`;

module.exports = {
  socials,
  repo: 'Air-zy/airWebsite',
  accent: '#cebe78',   // the terminal headings and the animation pane
  about: about.map(plain),
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
    v: ['css/main.css', 'js/main.js', 'js/dither.js', 'ROWA/r6.js', 'og.png'].reduce((h, f) => h.update(fs.readFileSync(__dirname + '/../public/' + f)), crypto.createHash('md5')).digest('hex').slice(0, 8),
  },
};

// node src/config/site.js
if (require.main === module) {
  const a = require('assert');
  const html = fs.readFileSync(__dirname + '/../public/index.html', 'utf8');

  // every token the page asks for has to exist here, and every shape has to be used
  const used = [...html.matchAll(/<!--#(\w+)-->/g)].map(m => m[1]);
  a.ok(used.length, 'index.html lost its tokens');
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

  console.log('site ok');
}
