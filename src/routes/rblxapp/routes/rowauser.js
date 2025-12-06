const { readFile } = require('fs').promises;
const { getThumb } = require('../rowautils');
module.exports = async (req, res) => {
  const num_id = Number(req.params.userid);
  if (!Number.isInteger(num_id)) {
    return next();
  }

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
  const desc = truncate(`elo: ${elo} \nwins: ${wins} \nlost: ${loss}`, 200);

  let userThumbnail = null
  try {
    userThumbnail = await getThumb(id)
  } catch (err) {
    console.log("rowautils thumbErr:",err)
  }
  try {
    let html = await readFile(__dirname + '/res/rowaPlr.html', 'utf8');
    let meta =
      `<title>${esc(title)}</title>\n` +
      `<meta property="og:title" content="${esc(title)}">\n` +
      `<meta name="description" content="${esc(desc)}">\n` +
      `<meta property="og:description" content="${esc(desc)}">`;

    if (userThumbnail) {
        meta += `\n<meta property="og:image" content="${esc(userThumbnail)}">`;
        meta += `\n<meta name="twitter:image" content="${esc(userThumbnail)}">`;
        meta += `\n<link rel="image_src" href="${esc(userThumbnail)}">`;
        meta += `\n<meta property="og:image:alt" content="${esc(title)}">`;
    }

    html = html.replace(/<head(?:\s[^>]*)?>/i, m => m + '\n' + meta);
    res.send(html);
  } catch (err) {
    console.log("injectile meta on rowaPlr html err:", err)
    res.status(500).end();
  }
};
