// talent card names, pulled from the game's public registry so a new card shows up here
// as soon as it is pushed. github gets asked at most once an hour
const REGISTRY = 'https://raw.githubusercontent.com/ROWA-dev/Changelog/main/Cards/registry.luau';

// a quoted luau string field inside one entry, "..." or '...'. the page drops these into html,
// so angle brackets never make it out
const field = (src, key) => {
  const m = src.match(new RegExp(`\\b${key}\\s*=\\s*(["'])((?:\\\\.|(?!\\1).)*)\\1`));
  return m ? m[2].replace(/\\(.)/g, '$1').replace(/[<>]/g, '') : undefined;
};

// each `[id] = {` header owns the text up to the next one, so nested req tables need no brace counting
function parse(text) {
  const body = text.split('table.freeze(cardList)')[0];
  const heads = [...body.matchAll(/\[(\d+)\]\s*=\s*\{/g)];
  const cards = {};
  heads.forEach((h, i) => {
    const src = body.slice(h.index + h[0].length, heads[i + 1]?.index);
    const name = field(src, 'name');
    if (!name) return;
    cards[h[1]] = {
      name,
      desc: field(src, 'desc') || '',
      tier: (src.match(/\btier\s*=\s*DraftTiers\.(\w+)/)?.[1] || 'common').toLowerCase(),
    };
  });
  return cards;
}

async function load() {
  const res = await fetch(REGISTRY, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`github ${res.status}`);
  return parse(await res.text());
}

// the promise is the cache, and the last good copy covers a github hiccup
let cache = null, good = null;
module.exports = async (req, res) => {
  if (!cache || Date.now() - cache.at > 3600e3) cache = { at: Date.now(), data: load() };
  try {
    res.json(good = await cache.data);
  } catch (err) {
    cache = null;
    console.warn('[rowa cards]', err.message);
    good ? res.json(good) : res.status(502).send('card registry unavailable');
  }
};

// node src/routes/api/rowa2/cards.js
if (require.main === module) {
  const a = require('assert');
  const cards = parse(`
    local cardList:clType = {
      [1] = { name = "Underdog", desc = "take 15% less", innate = true },
      [10] = {
        name = "Haki",
        desc = "+10% weapon \\"damage\\"<b>",
        req = { strength = 6, Or = { {hvy = 2}, {med = 2} } },
        tier = DraftTiers.RARE,
      },
      [18] = { name = 'Side Shotgun', req = { card = 17 }, replaces = 17 },
    }
    table.freeze(cardList)
    local x = { [99] = { name = "not a card" } }
  `);
  a.deepStrictEqual(Object.keys(cards), ['1', '10', '18']);
  a.deepStrictEqual(cards[10], { name: 'Haki', desc: '+10% weapon "damage"b', tier: 'rare' });
  a.strictEqual(cards[18].tier, 'common');
  console.log('cards ok');
}
