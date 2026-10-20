// full body renders for the rowa2 podium. open cloud only does headshots, so this is the
// public thumbnails api through roproxy, same proxy as the username batch, no key needed
const MAX_IDS = 100;   // what one upstream call takes

// the cdn urls come back tagged 30DAY, same reasoning as the headshot cache
const cache = {};

// true if roblox is still rendering some of them
async function fetchAvatars(ids) {
  const url = `https://thumbnails.roproxy.com/v1/users/avatar?userIds=${ids.join(',')}&size=420x420&format=Png&isCircular=false`;
  const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error('thumbnails ' + r.status);

  const { data = [] } = await r.json();
  for (const t of data) {
    if (t.state === 'Completed' && t.imageUrl) cache[t.targetId] = t.imageUrl;
  }
  return data.some(t => t.state === 'Pending');
}

module.exports = async (req, res) => {
  const ids = [...new Set(String(req.query.ids || '').split(',').map(Number))]
    .filter(n => Number.isInteger(n) && n > 0);
  if (!ids.length || ids.length > MAX_IDS) return res.status(400).json({ error: `need 1 to ${MAX_IDS} ids` });

  const missing = () => ids.filter(id => !cache[id]);
  try {
    // an avatar nobody has asked for in a while comes back Pending first, one retry usually lands it
    if (missing().length && await fetchAvatars(missing())) {
      await new Promise(r => setTimeout(r, 1500));
      await fetchAvatars(missing());
    }
  } catch (err) {
    // whatever is cached still goes out, the page falls back to headshots for the rest
    console.error('[avatars]', err.message);
  }

  res.json(Object.fromEntries(ids.filter(id => cache[id]).map(id => [id, cache[id]])));
};
