const envDecrypt = require('../../../FallbackEncryption/envDecrypt.js');
const rbxApiKey = envDecrypt(process.env.airKey, process.env.rowaCloudApi);

// one uncached call pages the whole datastore then fetches every entry, roughly
// 900 open cloud requests against a 1k/min key quota. an hour is plenty fresh for this.
const cache = { data: null, lastFetch: 0, ttl: 60 * 60 * 1000 };
let inFlight = null;

module.exports = async (req, res) => {
  if (cache.data && Date.now() - cache.lastFetch < cache.ttl) {
    return res.json(cache.data);
  }

  // if two people load the page at once, only one of them hits roblox
  if (inFlight) return res.json(await inFlight);

  try {
    inFlight = (async () => {
    const universeId = '8502229770';
    const store = 'plrDataV3';
    const scope = 'global';
    const listBase = `https://apis.roblox.com/cloud/v2/universes/${universeId}/data-stores/${encodeURIComponent(store)}/scopes/${encodeURIComponent(scope)}/entries`;
    const entryBase = listBase + '/'; // + id
    const headers = { 'x-api-key': rbxApiKey, Accept: 'application/json' };

    // page the list for ids
    let pageToken = '';
    const ids = [];
    do {
      const u = new URL(listBase);
      if (pageToken) u.searchParams.set('pageToken', pageToken);
      u.searchParams.set('limit', '100');
      const r = await fetch(u.toString(), { headers });
      if (!r.ok) throw new Error('list failed ' + r.status);
      const body = await r.json();
      const entries = body.dataStoreEntries || [];
      entries.forEach(e => ids.push(e.id));
      pageToken = body.nextPageToken || '';
      // mild throttle while paging
      if (pageToken) await new Promise(r => setTimeout(r, 120));
    } while (pageToken);

    // fetch values with limited concurrency
    const concurrency = 8;
    const results = [];
    const workers = Array.from({ length: concurrency }, async () => {
      while (ids.length) {
        const id = ids.shift();
        try {
          const r = await fetch(entryBase + encodeURIComponent(id), { headers });
          if (!r.ok) { console.error('get', id, r.status); continue; }
          const b = await r.json();
          results.push({ id, value: b.value }); // b may include metadata like revision
        } catch (err) { console.error('err get', id, err); }
        await new Promise(r => setTimeout(r, 20)); // tiny backoff per-request
      }
    });
    await Promise.all(workers);

      cache.data = results;
      cache.lastFetch = Date.now();
      return results;
    })();

    return res.json(await inFlight);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'plr data request err' });
  } finally {
    inFlight = null;
  }
};
