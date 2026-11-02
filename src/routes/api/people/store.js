// the my friends list, kept in firestore and out of the public repo. read again at most every 30s like the
// projects, and a save swaps it in straight away
const { firedbPeopleGet, firedbPeopleSave } = require('../../../firebase/firebasedb.js');

let list = null;
let fetchedAt = 0;

async function getPeople() {
  if (!list || Date.now() - fetchedAt > 30 * 1000) {
    list = await firedbPeopleGet();
    fetchedAt = Date.now();
  }
  return list;
}

async function savePeople(next) {
  await firedbPeopleSave(next);
  list = next;
  fetchedAt = Date.now();
}

// what peopleEdit sends, checked before it's saved, since every field ends up in the page's html. names and reasons
// are escaped when the list is drawn (site.js), but a link goes in an href as is, so only http and https, and the
// same for links inside {phrase|role|url} marks. roles are the three the page tints
const ROLES = new Set(['accent', 'name', 'tech']);
const isWebUrl = u => {
  try {
    return ['http:', 'https:'].includes(new URL(u).protocol);
  } catch {
    return false;
  }
};
const bad = message => Object.assign(new Error(message), { status: 400 });

function clean(input) {
  if (!Array.isArray(input) || input.length > 100) throw bad('the list has to be an array of up to 100 people');
  return input.map((p, i) => {
    const at = `person ${i + 1}`;
    if (!p || typeof p !== 'object') throw bad(`${at} isn't an object`);
    const name = typeof p.name === 'string' ? p.name.trim() : '';
    if (!name || name.length > 80) throw bad(`${at} needs a name, up to 80 characters`);
    const out = { name };

    const url = typeof p.url === 'string' ? p.url.trim() : '';
    if (url) {
      if (url.length > 300 || !isWebUrl(url)) throw bad(`${at}: the link has to be an http or https url`);
      out.url = url;
    } else if (p.url != null && typeof p.url !== 'string') throw bad(`${at}: the link has to be text`);

    const why = typeof p.why === 'string' ? p.why.trim() : '';
    if (why) {
      if (why.length > 300) throw bad(`${at}: the reason is up to 300 characters`);
      for (const m of why.matchAll(/\{([^|}]+)\|([^|}]+)(?:\|([^}]+))?\}/g)) {
        if (!ROLES.has(m[2])) throw bad(`${at}: in {${m[1]}|${m[2]}}, the role has to be tech, name or accent`);
        if (m[3] && !isWebUrl(m[3])) throw bad(`${at}: links in the reason have to be http or https`);
      }
      out.why = why;
    } else if (p.why != null && typeof p.why !== 'string') throw bad(`${at}: the reason has to be text`);

    return out;
  });
}

module.exports = { getPeople, savePeople, clean };
