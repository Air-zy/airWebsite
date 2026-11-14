// the projects on the home page, one firestore doc. read again at most every 30s like the friends, so a save from
// another copy of the server (localhost) or the firestore console shows up here too. nothing writes this copy back:
// a view is a +1 in firestore and a save keeps firestore's views. firestore is required on first use, so the checks
// at the bottom run without the .env
const db = () => require('../../../firebase/firebasedb.js');

let data = null;
let fetchedAt = 0;
let reading = null;

// one read at a time. when it fails the last list is still good to serve
async function getProjects() {
  if (!data || Date.now() - fetchedAt > 30 * 1000) {
    reading ??= db().firedbAirsiteGet()
      .then(d => {
        data = d ?? {};
        fetchedAt = Date.now();
      })
      .catch(err => {
        if (!data) throw err;
        console.error('[projects] read failed, serving the last list:', err.message);
      })
      .finally(() => { reading = null; });
    await reading;
  }
  return data;
}

// false when there's no such project
async function countView(key) {
  const projects = await getProjects();
  if (!Object.hasOwn(projects, key) || !await db().firedbAirsiteView(key)) return false;
  // so this copy shows it before the next read
  if (projects[key].stats) projects[key].stats.views++;
  return true;
}

async function saveProjects(next) {
  data = await db().firedbAirsiteSave(next);
  fetchedAt = Date.now();
  return data;
}

// what projectsEdit sends, { key: project }, checked before it's saved. the url, the picture and the [text]("url")
// links in the text go into the page as they are, so they have to be http, https or a path on this site. a missing
// rank is 1, like the homepage sorts it
const bad = message => Object.assign(new Error(message), { status: 400 });
const text = v => typeof v === 'string' ? v.trim() : '';
const isLink = u => {
  try {
    return ['http:', 'https:'].includes(new URL(u, 'https://airzy.ca').protocol);
  } catch {
    return false;
  }
};
// firestore saves __x__ names for itself, and a key ends up as a field name
const KEY = /^[A-Za-z0-9][\w-]{0,39}$/;

function list(v, name, most, longest, at) {
  if (v == null) return [];
  if (!Array.isArray(v)) throw bad(`${at}: ${name} has to be a list`);
  const out = v.map(text).filter(Boolean);
  if (out.length > most) throw bad(`${at}: up to ${most} ${name}`);
  const long = out.find(s => s.length > longest);
  if (long) throw bad(`${at}: "${long.slice(0, 30)}..." is over ${longest} characters`);
  return out;
}

function cleanProject(key, p) {
  if (!KEY.test(key)) throw bad(`"${key}" can't be a key, use letters, digits, _ and - (up to 40)`);
  if (!p || typeof p !== 'object') throw bad(`${key} isn't an object`);

  const title = text(p.title);
  if (!title || title.length > 80) throw bad(`${key} needs a title, up to 80 characters`);

  const url = text(p.url);
  if (!url || url.length > 300 || !isLink(url)) throw bad(`${key}: the url has to be http, https or a /path`);

  const img = text(p.img);
  if (img && (img.length > 500 || !isLink(img))) throw bad(`${key}: the image has to be http, https or a /path`);

  const alt = text(p.alt);
  if (alt.length > 200) throw bad(`${key}: the alt text is up to 200 characters`);

  const rank = p.rank == null || p.rank === '' ? 1 : Number(p.rank);
  if (!Number.isFinite(rank) || rank <= 0) throw bad(`${key}: the rank has to be a number above 0`);

  const lines = list(p.text, 'lines', 20, 300, key);
  for (const line of lines) {
    for (const m of line.matchAll(/\[([^\]]+)\]\("([^"]+)"\)/g)) {
      if (!isLink(m[2])) throw bad(`${key}: [${m[1]}]("${m[2]}") needs a link that's http, https or a /path`);
    }
  }
  const tags = list(p.tags, 'tags', 12, 40, key);

  // firestore's count wins for a project that's already there, see firedbAirsiteSave
  const views = Number(p.stats?.views);
  const out = { title, url, img, alt, rank, text: lines, tags, stats: { views: Number.isInteger(views) && views > 0 ? views : 0 } };
  if (p.hidden === true) out.hidden = true;
  return out;
}

function clean(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw bad('send { key: project }');
  const entries = Object.entries(input);
  // an empty list would wipe the doc
  if (!entries.length || entries.length > 50) throw bad('send between 1 and 50 projects');
  return Object.fromEntries(entries.map(([key, p]) => [key, cleanProject(key, p)]));
}

module.exports = { getProjects, countView, saveProjects, clean };

// node src/routes/api/projects/store.js, checks clean without touching firestore
if (require.main === module) {
  const a = require('assert');
  const ok = clean({
    chess: { title: ' Chess ', url: '/chess', img: '/chess/pieces/wn.svg', alt: ' knight ', rank: 1,
      text: [' - [WebAssembly]("https://webassembly.org/") ', '', '2026 - now'], tags: [' C++ ', ''], stats: { views: 41 } },
    'old-one': { title: 'Old', url: 'https://github.com/x/y', rank: null, text: [], tags: [], stats: {}, hidden: true },
    bare: { title: 'Bare', url: 'https://x.y', rank: '' },
  });
  a.deepStrictEqual(ok, {
    chess: { title: 'Chess', url: '/chess', img: '/chess/pieces/wn.svg', alt: 'knight', rank: 1,
      text: ['- [WebAssembly]("https://webassembly.org/")', '2026 - now'], tags: ['C++'], stats: { views: 41 } },
    'old-one': { title: 'Old', url: 'https://github.com/x/y', img: '', alt: '', rank: 1, text: [], tags: [], stats: { views: 0 }, hidden: true },
    bare: { title: 'Bare', url: 'https://x.y', img: '', alt: '', rank: 1, text: [], tags: [], stats: { views: 0 } },
  });
  const p = extra => ({ x: { title: 'X', url: '/x', ...extra } });
  const no = (input, msg) => a.throws(() => clean(input), e => e.status === 400 && msg.test(e.message), String(msg));
  no(null, /send/);
  no([], /send/);
  no({}, /between 1 and 50/);
  no({ __x__: p().x }, /can't be a key/);
  no({ 'a.b': p().x }, /can't be a key/);
  no({ x: { url: '/x' } }, /needs a title/);
  no(p({ url: '' }), /url has to be/);
  no(p({ url: 'javascript:alert(1)' }), /url has to be/);
  no(p({ img: 'javascript:alert(1)' }), /image has to be/);
  no(p({ rank: 0 }), /rank has to be/);
  no(p({ rank: 'two' }), /rank has to be/);
  no(p({ text: 'one line' }), /lines has to be a list/);
  no(p({ text: ['see [this]("javascript:alert(1)")'] }), /needs a link/);
  no(p({ tags: Array(13).fill('t') }), /up to 12 tags/);
  no(p({ tags: ['x'.repeat(41)] }), /over 40 characters/);
  // __proto__ from JSON.parse is an own key, the way a request body brings it
  no(JSON.parse('{"__proto__": {"title": "X", "url": "/x"}}'), /can't be a key/);
  console.log('store ok');
  process.exit(0);
}
