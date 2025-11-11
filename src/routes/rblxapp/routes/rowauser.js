const { readFile } = require('fs').promises;

module.exports = async (req, res) => {
  const id = String(req.params.userid || '');
  let loss = '0', wins = '0', elo = '0';
  let displayName = id;

  const base = `${req.protocol}://${req.get('host')}`;
  const rowaUrl = `${base}/api/rowa/${encodeURIComponent(id)}`;
  const robloxUrl = `${base}/api/roblox-user/${encodeURIComponent(id)}`;

  const [rowaRes, robloxRes] = await Promise.allSettled([fetch(rowaUrl), fetch(robloxUrl)]);

  if (rowaRes.status === 'fulfilled' && rowaRes.value.ok) {
    try {
      const data = await rowaRes.value.json();
      loss = String(data.loss ?? loss);
      wins = String(data.wins ?? wins);
      elo = String(data.elo ?? elo);
    } catch (e) {
      console.log('rowa parse err', e);
    }
  } else if (rowaRes.status === 'rejected') {
    console.log('rowa fetch err', rowaRes.reason);
  }

  if (robloxRes.status === 'fulfilled' && robloxRes.value.ok) {
    try {
      const rdata = await robloxRes.value.json();
      displayName = String(rdata.displayName) + " @" + String(rdata.name);
    } catch (e) {
      console.log('roblox parse err', e);
    }
  } else if (robloxRes.status === 'rejected') {
    console.log('roblox fetch err', robloxRes.reason);
  }

  const esc = s => String(s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );
  const truncate = (s, n = 200) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

  const title = displayName;
  const desc = truncate(`${title} — ELO ${elo} • ${wins}W • ${loss}L`, 200);

  try {
    let html = await readFile(__dirname + '/res/rowaPlr.html', 'utf8');
    const meta =
      `<title>${esc(title)}</title>\n` +
      `<meta property="og:title" content="${esc(title)}">\n` +
      `<meta name="description" content="${esc(desc)}">\n` +
      `<meta property="og:description" content="${esc(desc)}">`;
    html = html.replace(/<head(?:\s[^>]*)?>/i, m => m + '\n' + meta);
    res.send(html);
  } catch (err) {
    res.status(500).end();
  }
};
