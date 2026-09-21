// the only copy of this stuff. cli.js reads the data, minify.js pastes the html into index.html at boot
// change a link or a skill here and nowhere else

const fs = require('fs');

const socials = [
  { label: 'GitHub',    icon: 'fa-github',           url: 'https://github.com/Air-zy' },
  { label: 'Linked In', icon: 'fa-linkedin-square',  url: 'https://www.linkedin.com/in/airzy-turqueza-7994762b3/' },
  { label: 'Leetcode',  icon: 'fa-code',             url: 'https://leetcode.com/u/AirzyEz/' },
  { label: 'Youtube',   icon: 'fa-youtube-play',     url: 'https://www.youtube.com/channel/UCgyAZGAZR_knbCnp-bP9wkw' },
  { label: 'Instagram', icon: 'fa-instagram',        url: 'https://www.instagram.com/airzyalt' },
  { label: 'Snapchat',  icon: 'fa-snapchat-ghost',   url: 'https://www.snapchat.com/add/airalternative' },
  { label: 'X',         icon: 'fa-twitter',          url: 'https://x.com/airzyalt' },
];

const nav = [
  { label: 'Home',      href: '/home' },
  { label: 'Airzy',     click: 'toAirzy()' },
  { label: 'Contact',   click: 'toContact()' },
  { label: 'Resources', click: 'toResources()' },
];

const about = [
  'studied {software development|#ffc300} at {SAIT|#ff5733}.',
  'i write code and build games when I am bored.',
  'programming {since 2018|#ff99cc}.',
];

const skills = {
  Languages: ['C++', 'Javascript', 'HTML/CSS', 'Luau'],
  Technologies: ['Node.js', 'Socket.io', 'Express'],
  Other: ['SQL', 'Hugging Face', 'Roblox Game Development'],
};

// button not div, so the three scroll items take focus and fire on enter/space.
// span not div because a button only takes phrasing content
// symbol ids are the fa name minus the prefix, see icons.svg
const icon = name => `<svg class="icon" aria-hidden="true"><use href="#i-${name.replace('fa-', '')}"/></svg>`;

const navItem = n => n.href
  ? `<a class="nav-item" href="${n.href}">${n.label} <span class="underline"></span></a>`
  : `<button class="nav-item" onclick="${n.click}">${n.label} <span class="underline"></span></button>`;

// {phrase|color} is a phrase the page tints. the cli just drops the braces
const colorize = l => l.replace(/\{([^|}]+)\|([^}]+)\}/g, '<span style="color: $2">$1</span>');
const plain = l => l.replace(/\{([^|}]+)\|[^}]+\}/g, '$1');

const list = items => `<ul>${items.map(i => `<li>${i}</li>`).join('')}</ul>`;

// Other is a details so it starts collapsed, the first two groups are always open
const skillGroup = ([name, items]) => name === 'Other'
  ? `<details><summary class="summary-button">${list([name])}</summary><blockquote>${list(items)}</blockquote></details>`
  : `${list([name])}<blockquote>${list(items)}</blockquote>`;

module.exports = {
  socials,
  repo: 'Air-zy/airWebsite',
  accent: '#cebe78',   // the terminal headings and the animation pane
  about: about.map(plain),
  skills,

  // the shapes index.html asks for by name, see the <!--#token--> comments in it.
  // the icons are inline with no margin, so the space between them is the gap. keep the join(' ')
  html: {
    socialIcons: socials
      .map(s => `<a href="${s.url}" class="fa" target="_blank" aria-label="${s.label}">${icon(s.icon)}</a>`).join(' '),

    socialLinks: socials
      .map(s => `<a href="${s.url}" target="_blank">${icon(s.icon)}${s.label}</a>`).join(' '),

    skills: Object.entries(skills).map(skillGroup).join(''),

    nav: nav.map(navItem).join(' '),

    // inlined so the icons cost no request, replaces 108kb of cdn font awesome
    icons: fs.readFileSync(__dirname + '/icons.svg', 'utf8').trim(),

    about: about.map(l => `<p>${colorize(l)}</p>`).join(''),

    // built once at boot, a server left running over new years eve keeps the old year until it restarts
    copyright: `© ${new Date().getFullYear()} Airzy Turqueza.`,
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
  for (const s of socials) a.ok(module.exports.html.socialIcons.includes(s.url));
  for (const s of socials) a.ok(module.exports.html.socialLinks.includes(s.label));
  a.ok(module.exports.html.skills.includes('<li>Luau</li>'));
  a.ok(module.exports.html.skills.includes('<details>'));
  for (const n of nav) a.ok(module.exports.html.nav.includes(n.label));
  a.ok(module.exports.html.nav.includes('<button class="nav-item"'), 'the click items have to be buttons');
  a.ok(!module.exports.html.nav.includes('<div class="nav-item"'), 'a div is not keyboard reachable');
  for (const s of socials) a.ok(module.exports.html.socialIcons.includes(`aria-label="${s.label}"`));
  a.ok(module.exports.html.copyright.includes(String(new Date().getFullYear())));
  a.ok(!module.exports.about.join(' ').match(/[{}|]/), 'braces leaked into the cli text');
  a.ok(module.exports.html.about.includes('color: #ffc300'));
  for (const s of socials) a.ok(module.exports.html.icons.includes(`id="i-${s.icon.replace('fa-', '')}"`), `sprite lost ${s.icon}`);
  for (const m of html.matchAll(/#i-([a-z0-9-]+)/g)) a.ok(module.exports.html.icons.includes(`id="${m[0].slice(1)}"`), `sprite lost ${m[1]}`);
  a.ok(module.exports.html.icons.includes('display:none'), 'hidden does nothing on an svg, without display none the sprite renders 300x150');
  a.ok(!html.includes('font-awesome'), 'the sprite replaced font awesome, the cdn link stays gone');
  a.ok(html.includes('id="adapt"'), 'main.js animates this one, it stays in the page');

  console.log('site ok');
}
