// the my friends section, kept in firestore and out of the public repo. read again at most every 30s like the
// projects, and a save swaps it in straight away. firestore is required on first use, so the checks at the bottom
// run without the .env
const db = () => require('../../../firebase/firebasedb.js');

let data = null;
let fetchedAt = 0;

async function getPeople() {
  if (!data || Date.now() - fetchedAt > 30 * 1000) {
    data = await db().firedbPeopleGet();
    fetchedAt = Date.now();
  }
  return data;
}

async function savePeople(next) {
  await db().firedbPeopleSave(next);
  data = next;
  fetchedAt = Date.now();
}

// what peopleEdit sends, { groups, people } as site.js describes, checked before it's saved, since every field ends up
// in the page's html. names, reasons and group names are escaped when it's drawn (site.js), but a link goes in an
// href as is, so only http and https, and the same for links inside {phrase|role|url} and [text](url) marks.
// roles are the three the page tints
const ROLES = new Set(['accent', 'name', 'tech']);
const isWebUrl = u => {
  try {
    return ['http:', 'https:'].includes(new URL(u).protocol);
  } catch {
    return false;
  }
};
const bad = message => Object.assign(new Error(message), { status: 400 });
const text = v => typeof v === 'string' ? v.trim() : '';

// [{ name, note? }], the note is the bit after the name, like "our team at SAIT"
function cleanGroups(input) {
  if (input == null) return [];
  if (!Array.isArray(input) || input.length > 20) throw bad('groups has to be a list of up to 20');
  const groups = input.map((g, i) => {
    if (!g || typeof g !== 'object') throw bad(`group ${i + 1} isn't an object`);
    const name = text(g.name);
    if (!name || name.length > 40) throw bad(`group ${i + 1} needs a name, up to 40 characters`);
    const note = text(g.note);
    if (note.length > 80) throw bad(`${name}: the note is up to 80 characters`);
    return note ? { name, note } : { name };
  });
  const names = groups.map(g => g.name);
  const twice = names.find((n, i) => names.indexOf(n) !== i);
  if (twice) throw bad(`there are two groups called ${twice}`);
  return groups;
}

function cleanPerson(p, i, groups) {
  const at = `friend ${i + 1}`;
  if (!p || typeof p !== 'object') throw bad(`${at} isn't an object`);
  const name = text(p.name);
  if (!name || name.length > 80) throw bad(`${at} needs a name, up to 80 characters`);
  const out = { name };

  if (p.links != null && !Array.isArray(p.links)) throw bad(`${name}: links has to be a list`);
  out.links = (p.links ?? []).map(text).filter(Boolean);
  if (out.links.length > 6) throw bad(`${name}: up to 6 links`);
  for (const u of out.links) {
    if (u.length > 300 || !isWebUrl(u)) throw bad(`${name}: ${u} isn't an http or https link`);
  }

  const why = text(p.why);
  if (why) {
    if (why.length > 300) throw bad(`${name}: the reason is up to 300 characters`);
    for (const m of why.matchAll(/\{([^|}]+)\|([^|}]+)(?:\|([^}]+))?\}/g)) {
      if (!ROLES.has(m[2])) throw bad(`${name}: in {${m[1]}|${m[2]}}, the role has to be tech, name or accent`);
      if (m[3] && !isWebUrl(m[3])) throw bad(`${name}: links in the reason have to be http or https`);
    }
    // a [text](www.x.com) would show as typed, say so instead
    for (const m of why.matchAll(/\[([^\]]+)\]\(([^)\s]+)\)/g)) {
      if (!isWebUrl(m[2])) throw bad(`${name}: [${m[1]}](${m[2]}) needs a link starting with https://`);
    }
    out.why = why;
  } else if (p.why != null && typeof p.why !== 'string') throw bad(`${name}: the reason has to be text`);

  // the first is where their entry goes, a repeat adds nothing so it's dropped
  if (p.groups != null && !Array.isArray(p.groups)) throw bad(`${name}: groups has to be a list`);
  out.groups = [...new Set((p.groups ?? []).map(text).filter(Boolean))];
  for (const g of out.groups) if (!groups.some(x => x.name === g)) throw bad(`${name}: there's no group called ${g}`);
  return out;
}

function clean(input) {
  if (!input || typeof input !== 'object') throw bad('send { groups, people }');
  const groups = cleanGroups(input.groups);
  if (!Array.isArray(input.people) || input.people.length > 100) throw bad('people has to be a list of up to 100 friends');
  return { groups, people: input.people.map((p, i) => cleanPerson(p, i, groups)) };
}

module.exports = { getPeople, savePeople, clean };

// node src/routes/api/people/store.js, checks clean without touching firestore
if (require.main === module) {
  const a = require('assert');
  const ok = clean({ groups: [{ name: ' SAIT ', note: ' ' }, { name: 'team bravo', note: ' our team ' }], people: [
    { name: ' kate ', links: [' https://github.com/k ', '', 'https://k.dev'], why: ' a [PTCG](https://x.y) {AI|tech} ', groups: ['team bravo', 'SAIT', 'team bravo'] },
    { name: 'loose' },
  ] });
  a.deepStrictEqual(ok, { groups: [{ name: 'SAIT' }, { name: 'team bravo', note: 'our team' }], people: [
    { name: 'kate', links: ['https://github.com/k', 'https://k.dev'], why: 'a [PTCG](https://x.y) {AI|tech}', groups: ['team bravo', 'SAIT'] },
    { name: 'loose', links: [], groups: [] },
  ] });
  const no = (input, msg) => a.throws(() => clean(input), e => e.status === 400 && msg.test(e.message), String(msg));
  no(null, /send/);
  no({ groups: [{ name: 'a' }, { name: 'a', note: 'b' }], people: [] }, /two groups called a/);
  no({ groups: [{ name: '' }], people: [] }, /group 1 needs a name/);
  no({ groups: ['SAIT'], people: [] }, /group 1 isn't an object/);
  no({ groups: [{ name: 'a', note: 'x'.repeat(81) }], people: [] }, /note is up to 80/);
  no({ groups: [], people: [{ name: 'k', groups: ['SAIT'] }] }, /no group called SAIT/);
  no({ groups: [], people: [{ name: 'k', links: ['javascript:alert(1)'] }] }, /isn't an http/);
  no({ groups: [], people: [{ name: 'k', links: 'https://x.y' }] }, /has to be a list/);
  no({ groups: [], people: [{ name: 'k', links: Array(7).fill('https://x.y') }] }, /up to 6/);
  no({ groups: [], people: [{ name: 'k', why: 'a [site](www.x.y)' }] }, /needs a link starting with https/);
  no({ groups: [], people: [{ name: 'k', why: '{x|blue}' }] }, /role has to be/);
  no({ groups: [], people: [{ name: '' }] }, /friend 1 needs a name/);
  console.log('store ok');
  process.exit(0);
}
