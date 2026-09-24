// caliperbench.com has no api, the whole board is a json literal inside its 4mb homepage
const SRC = 'https://caliperbench.com/';
const HOUR = 3600000, MINUTE = 60000;

let body = null, at = 0, pending = null;

// avy: scrapes their inline script, breaks if they rename DATA or COLS
const grab = (html, name) => JSON.parse(html.match(new RegExp(`const ${name} = (\\[.*?\\]);\\n`, 's'))[1]);

async function load() {
  at = Date.now();
  try {
    const res = await fetch(SRC, { headers: { 'User-Agent': 'airzy.ca' }, signal: AbortSignal.timeout(20000) });
    if (!res.ok) throw new Error(`status ${res.status}`);
    const html = await res.text();
    const rows = grab(html, 'DATA');

    // their numeric columns plus every text and flag field (name, link, class), other numbers are internals
    const cols = grab(html, 'COLS').filter(c => rows.some(r => typeof r[c.field] === 'number'));
    const keep = new Set(cols.map(c => c.field));
    const pick = r => Object.fromEntries(Object.entries(r).filter(([k, v]) => keep.has(k) || v !== null && typeof v !== 'number'));

    // 4 digits halves the payload, strings get escaped not stripped since they hit innerHTML (">1 = darker")
    const esc = { '<': '&lt;', '>': '&gt;', '"': '&quot;' };
    body = JSON.stringify({ cols, rows: rows.map(pick) }, (k, v) =>
      typeof v === 'number' ? +v.toPrecision(4) : typeof v === 'string' ? v.replace(/[<>"]/g, c => esc[c]) : v);
  } catch (err) {
    console.error('[caliper] refresh failed:', err.message);
  }
}

// stale copy is served while the refresh runs, a failed first load retries after a minute not an hour
module.exports = async (req, res) => {
  if (Date.now() - at > (body ? HOUR : MINUTE)) pending ??= load().finally(() => pending = null);
  if (!body) await pending;
  if (!body) return res.status(502).json({ error: 'caliper-unavailable' });
  res.type('json').set('Cache-Control', 'public, max-age=3600').send(body);
};
