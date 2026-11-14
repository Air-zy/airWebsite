// the live roblox numbers in "how i started" on the home page and all over /roblox: my public games, their visits, the
// visits of the group games i helped with, and how many games i made each year. the browser cant ask roblox itself (no
// cors), and roblox gets asked at most every 6 hours
const UID = 498605109; // Airzy_Az
// only groups i actually built in (Statical Productions, ROWA development). a member of a big studio didnt make its
// games, counting those would oversell
const GROUPS = [8001123, 8616919];
const HOURS = 6;
// /roblox asks for the visits of the games it lists with ?ids=, the home page asks for none
const MAX_IDS = 50;

// every page of a games list, roblox hands out 50 or 100 at a time
async function pages(url) {
  const out = [];
  let cursor = '';
  do {
    const res = await fetch(url + (cursor && '&cursor=' + cursor), { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`roblox ${res.status} ${url}`);
    const j = await res.json();
    out.push(...j.data);
    cursor = j.nextPageCursor;
  } while (cursor);
  return out;
}

// roblox's own game objects, only id, created and placeVisits are read. years goes by the year a game was made, so it
// only changes when i make a new one
function summarize(mine, groupGames) {
  const sum = list => list.reduce((s, g) => s + (g.placeVisits || 0), 0);
  const years = {};
  for (const g of mine) {
    const y = (years[g.created.slice(0, 4)] ??= { games: 0, visits: 0 });
    y.games++;
    y.visits += g.placeVisits || 0;
  }
  const visitsOf = new Map([...mine, ...groupGames.flat()].map(g => [String(g.id), g.placeVisits || 0]));
  return { stats: { games: mine.length, visits: sum(mine), groups: sum(groupGames.flat()), years }, visitsOf };
}

// the visits of the asked ids that are mine or a group's, anything else is left out
function pick(visitsOf, ids = '') {
  const of = {};
  for (const id of String(ids).split(',').slice(0, MAX_IDS)) if (visitsOf.has(id)) of[id] = visitsOf.get(id);
  return of;
}

async function load() {
  // ponytail: games.roblox.com straight from the server, like api_rblx.js. if the host ever gets throttled,
  // games.roproxy.com takes the same paths
  const mine = await pages(`https://games.roblox.com/v2/users/${UID}/games?accessFilter=Public&limit=50`);
  const groupGames = [];
  for (const id of GROUPS) groupGames.push(await pages(`https://games.roblox.com/v2/groups/${id}/gamesV2?accessFilter=Public&limit=100`));
  return summarize(mine, groupGames);
}

// the promise is the cache, so ten visitors at once still ask roblox once
let cache = null;
module.exports = async (req, res) => {
  if (!cache || Date.now() - cache.at > HOURS * 3600e3) cache = { at: Date.now(), data: load() };
  try {
    const { stats, visitsOf } = await cache.data;
    res.json(req.query.ids ? { ...stats, of: pick(visitsOf, req.query.ids) } : stats);
  } catch (err) {
    cache = null; // the next visitor tries roblox again
    console.warn('[roblox stats]', err.message);
    res.status(502).send('roblox did not answer');
  }
};

// node src/routes/api/api_robloxStats.js
if (require.main === module) {
  const a = require('assert');
  const game = (id, placeVisits, created = '2020-05-01T00:00:00Z') => ({ id, placeVisits, created });
  const { stats, visitsOf } = summarize(
    [game(1, 0, '2018-04-21T00:00:00Z'), game(2, 99), game(3, 12000), { id: 4, created: '2020-01-01T00:00:00Z' }],
    [[game(5, 5), game(6, 7)], [game(7, 10)]],
  );
  a.deepStrictEqual(stats, {
    games: 4, visits: 12099, groups: 22,
    years: { 2018: { games: 1, visits: 0 }, 2020: { games: 3, visits: 12099 } },
  });
  a.deepStrictEqual(summarize([], [[], []]).stats, { games: 0, visits: 0, groups: 0, years: {} });
  // mine and the groups' both answer, a stranger's id or junk doesn't
  a.deepStrictEqual(pick(visitsOf, '3,7,999,abc,'), { 3: 12000, 7: 10 });
  a.deepStrictEqual(pick(visitsOf, ['3', '7']), { 3: 12000, 7: 10 }, 'a repeated ?ids= comes in as an array, String joins it');
  a.strictEqual(Object.keys(pick(new Map(Array.from({ length: 80 }, (_, i) => [String(i), i])), Array.from({ length: 80 }, (_, i) => i).join(','))).length, MAX_IDS);
  console.log('roblox stats ok');
}
