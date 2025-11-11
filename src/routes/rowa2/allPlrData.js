const envDecrypt = require('../../envDecrypt.js');
const rbxApiKey = envDecrypt(process.env.airKey, process.env.rowaCloudApi);

module.exports = async (req, res) => {
  try {
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

    return res.json(results);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'plr data request err' });
  }
};
