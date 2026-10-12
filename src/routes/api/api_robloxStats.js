// the live roblox numbers in "how i started" on the home page: my public games, their visits, and the visits of
// the group games i helped with. the browser cant ask roblox itself (no cors), and roblox gets asked at most every 6 hours
const UID = 498605109; // Airzy_Az
// only groups i actually built in (Statical Productions, ROWA development). a member of a big studio didnt make its
// games, counting those would oversell
const GROUPS = [8001123, 8616919];
const HOURS = 6;

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

// roblox's own game objects, only placeVisits is read
function summarize(mine, groupGames) {
  const sum = list => list.reduce((s, g) => s + (g.placeVisits || 0), 0);
  return { games: mine.length, visits: sum(mine), groups: sum(groupGames.flat()) };
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
    res.json(await cache.data);
  } catch (err) {
    cache = null; // the next visitor tries roblox again
    console.warn('[roblox stats]', err.message);
    res.status(502).send('roblox did not answer');
  }
};

// node src/routes/api/api_robloxStats.js
if (require.main === module) {
  const a = require('assert');
  const game = placeVisits => ({ placeVisits });
  a.deepStrictEqual(
    summarize([game(0), game(99), game(12000), {}], [[game(5), game(7)], [game(10)]]),
    { games: 4, visits: 12099, groups: 22 },
  );
  a.deepStrictEqual(summarize([], [[], []]), { games: 0, visits: 0, groups: 0 });
  console.log('roblox stats ok');
}
