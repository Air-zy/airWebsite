const { readFile } = require('fs').promises;
const { getThumb, getPlrData } = require('../rowautils');
const { idtoname } = require('../rblxutils');
module.exports = async (req, res, next) => {
  const num_id = Number(req.params.userid);
  if (!Number.isInteger(num_id)) {
    return next();
  }

  const id = String(req.params.userid || '');
  let loss = '0', wins = '0', elo = '0';
  let displayName = id;

  // the same calls /api/rowa/:id and /api/roblox-user/:id make, without a round trip back into this server
  const [rowaRes, robloxRes] = await Promise.allSettled([getPlrData(id), idtoname(id)]);

  if (rowaRes.status === 'fulfilled') {
    const data = rowaRes.value || {}; // no datastore entry for this id
    loss = String(data.loss ?? loss);
    wins = String(data.wins ?? wins);
    elo = String(data.elo ?? elo);
  } else {
    console.log('rowa fetch err', rowaRes.reason);
  }

  if (robloxRes.status === 'fulfilled') {
    const rdata = robloxRes.value;
    displayName = String(rdata.displayName) + " @" + String(rdata.name);
  } else {
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
