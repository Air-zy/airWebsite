const { rbxApiKey, ENTRIES } = require('../../rblxapp/rowautils.js');

// one uncached call pages the whole datastore then fetches every entry, roughly
// 900 open cloud requests against a 1k/min key quota. an hour is plenty fresh for this.
const TTL = 60 * 60 * 1000;
const headers = { 'x-api-key': rbxApiKey, Accept: 'application/json' };

async function load() {
  // page the list for ids
  let pageToken = '';
  const ids = [];
  do {
    const u = new URL(ENTRIES);
    if (pageToken) u.searchParams.set('pageToken', pageToken);
    u.searchParams.set('limit', '100');
    const r = await fetch(u, { headers });
    if (!r.ok) throw new Error('list failed ' + r.status);
    const body = await r.json();
    ids.push(...(body.dataStoreEntries || []).map(e => e.id));
    pageToken = body.nextPageToken || '';
    // mild throttle while paging
    if (pageToken) await new Promise(r => setTimeout(r, 120));
  } while (pageToken);

  // fetch values with limited concurrency
  const results = [];
  const workers = Array.from({ length: 8 }, async () => {
    while (ids.length) {
      const id = ids.shift();
      try {
        const r = await fetch(ENTRIES + '/' + encodeURIComponent(id), { headers });
        if (!r.ok) { console.error('get', id, r.status); continue; }
        const b = await r.json();
        results.push({ id, value: b.value }); // b may include metadata like revision
      } catch (err) { console.error('err get', id, err); }
      await new Promise(r => setTimeout(r, 20)); // tiny backoff per-request
    }
  });
  await Promise.all(workers);
  return results;
}

// the promise is the cache, so two people loading at once share one run against roblox.
// a failed run is dropped, unless a newer one already took its place
let cache = null;
module.exports = async (req, res) => {
  if (!cache || Date.now() - cache.at > TTL) cache = { at: Date.now(), data: load() };
  const { data } = cache;
  try {
    res.json(await data);
  } catch (err) {
    if (cache?.data === data) cache = null;
    console.error(err);
    res.status(500).json({ error: 'plr data request err' });
  }
};
