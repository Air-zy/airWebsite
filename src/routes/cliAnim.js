// what curl gets on the root. a full 81x23 repaint every 25ms, half blocks so
// one cell holds two pixels, and a pixel wakes hot then cools to its colour. copied from sage.cat
const fs = require('fs');
const zlib = require('zlib');
const site = require('../config/site.js');

const MS = 25;                 // one frame
const FADE = 6;                // frames a pixel takes to cool from white
const COLS = 40, ROWS = 22;    // image pane, so the art is 40 wide and 44 tall
const GAP = 3, TEXTW = 41;     // the text pane sits to the right of the art
const FG = [192, 192, 192], ACCENT = site.accent;

// ponytail: 8 bit rgb or rgba only. no palette, no 16 bit, no interlace
function loadArt(file) {
  const buf = fs.readFileSync(file);
  const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20);
  const depth = buf[24], kind = buf[25], interlaced = buf[28];
  // most editors save indexed by default, which would read as garbage
  if (depth !== 8 || (kind !== 2 && kind !== 6) || interlaced) {
    throw new Error(`${file}: need 8 bit rgb or rgba, not interlaced. got depth ${depth}, `
      + `colour type ${kind}${interlaced ? ', interlaced' : ''}. re-export as rgba`);
  }
  const bpp = kind === 6 ? 4 : 3;
  const idat = [];
  for (let p = 8; p + 8 <= buf.length;) {
    const len = buf.readUInt32BE(p);
    if (buf.toString('latin1', p + 4, p + 8) === 'IDAT') idat.push(buf.subarray(p + 8, p + 8 + len));
    p += len + 12;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w * bpp;
  const out = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) {
    const filter = raw[y * (stride + 1)];
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? out[y * stride + i - bpp] : 0;
      const b = y ? out[(y - 1) * stride + i] : 0;
      const c = y && i >= bpp ? out[(y - 1) * stride + i - bpp] : 0;
      let v = raw[y * (stride + 1) + 1 + i];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      out[y * stride + i] = v;
    }
  }
  return Array.from({ length: h }, (_, y) => Array.from({ length: w }, (_, x) => {
    const i = y * stride + x * bpp;
    return bpp === 4 && out[i + 3] < 128 ? null : [out[i], out[i + 1], out[i + 2]];
  }));
}

const ART = loadArt(__dirname + '/../config/cliart.png');
const AH = ROWS * 2;                 // the art is exactly one pane, two pixels per cell row
if (ART.length !== AH || ART[0].length !== COLS) {
  throw new Error(`cliart.png must be ${COLS}x${AH}, got ${ART[0].length}x${ART.length}`);
}
const CX = COLS / 2;

// every effect answers one thing: which frame does this pixel wake on.
// x is a column, y is a pixel row, and a half block pixel is about square
const rnd = n => Math.random() * n - n / 2;
const perCol = f => Array.from({ length: COLS }, f);

// the radial effects centre on the sprite, not the pane. measured from the art, so
// swapping cliart.png keeps them centred
const [HX, HY] = (() => {
  let n = 0, sx = 0, sy = 0;
  ART.forEach((row, y) => row.forEach((p, x) => { if (p) { n++; sx += x; sy += y; } }));
  return [sx / n, sy / n];
})();
const L1 = (x, y) => Math.abs(x - HX) + Math.abs(y - HY);

const EFFECTS = {
  scanline:   () => (x, y) => y * 0.791 + 0.42 + rnd(0.79),
  typewriter: () => (x, y) => y * 0.837 + x * 0.022 + 0.38 + rnd(0.78),
  diagonal:   () => (x, y) => x * 0.429 + y * 0.415 + 2.54 + rnd(5.92),
  zigzag:     () => (x, y) => y * 0.653 + (y % 2 ? COLS - x : x) * 0.2 + 0.34 + rnd(0.75),
  // each row comes in from its own edge, the ones from the right start a little later
  rowslide:   () => (x, y) => (y % 2 ? 7.63 + (COLS - 1 - x) * 0.597 : 6.88 + x * 0.604) + rnd(1.91),
  interlace:  () => (x, y) => (y % 2) * 17.8 + x * 0.415 + 1.82 + rnd(4.36),
  curtain:    () => (x, y) => Math.abs(x - CX) * 1.22 + y * 0.266 + 1.14 + rnd(2.14),
  unfold:     () => (x, y) => Math.abs(x - CX) * 1.405 + y * 0.094 + 2.0 + rnd(3.93),
  crosshair:  () => (x, y) => Math.min(Math.abs(x - HX), Math.abs(y - HY)) * 1.287 + 3.13 + rnd(5.99),
  diamond:    () => (x, y) => L1(x, y) * 1.044 + 4.42 + rnd(8.18),
  // grows inward from the four corners
  corners:    () => (x, y) => Math.min(Math.hypot(x, y), Math.hypot(COLS - x, y),
                                       Math.hypot(x, AH - 1 - y), Math.hypot(COLS - x, AH - 1 - y)) * 1.075 + 3.21 + rnd(6.2),
  bloom:      () => (x, y) => Math.hypot(x - HX, y - HY) * 0.964 + 9.04 + rnd(20.0),
  converge:   () => (x, y) => 30.9 - Math.hypot(x - HX, y - HY) * 0.928 + rnd(20.37),
  // one arm, a full turn inward, and the sweep is not steady so the angle carries a sine.
  // ponytail: this centre is not the centre of mass and I never worked out what it is
  spiral_in:  () => (x, y) => {
    const cx = HX + 1.17, cy = HY + 2.87;
    const r = Math.hypot(x - cx, y - cy);
    const a = ((Math.atan2(y - cy, x - cx) - 3.0021) / (2 * Math.PI) + 2) % 1;
    return 27.3 - r * 1.108 + a * 10.947 + Math.sin(2 * Math.PI * a) * 3.12 + rnd(4.52);
  },
  wave:       () => (x, y) => x * 0.693 + Math.sin(y * 2 * Math.PI / 12.5) * 5.97 + 2.19 + rnd(3.71),
  rain:       () => (x, y) => y * 0.516 + 8.76 + rnd(12.28),
  // banded not grainy, each column starts on its own and rides up together
  bounce:     () => { const s = perCol(() => 28.77 + rnd(15.1)); return (x, y) => s[x] - y * 0.468 + rnd(2.29); },
  cascade:    () => { const s = perCol(() => 0.89 + Math.random() * 24.3); return (x, y) => s[x] + y * 0.272 + rnd(3.94); },
  matrix:     () => { const v = perCol(() => 0.228 + Math.random() * 0.71); return (x, y) => y * v[x] + 1.29 + rnd(2.01); },
};
const NAMES = Object.keys(EFFECTS);

// EFFECTS[q] would hand back Object.prototype for ?a=constructor
const pick = q => NAMES.includes(q) ? q : NAMES[Math.floor(Math.random() * NAMES.length)];

// {phrase|#hex} is the same markup site.js already uses for the homepage
const hex = h => h.length === 4
  ? [1, 2, 3].map(i => parseInt(h[i] + h[i], 16))
  : [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));

const spans = line => line.split(/(\{[^|}]+\|[^}]+\})/).filter(Boolean).map(part => {
  const m = part.match(/^\{([^|}]+)\|([^}]+)\}$/);
  return m ? [m[1], hex(m[2])] : [part, FG];
});

const visible = line => spans(line).reduce((n, s) => n + s[0].length, 0);

// pane row -> line, the rows left out are the spacing
const LINES = [
  [7,  `{airzy.ca|${ACCENT}}`],
  [9,  'i write code and build games for fun.'],
  [11, 'for more info'],
  [12, `  {curl airzy.ca/cli|${ACCENT}}`],
  [14, '{you can curl this again|#555555}'],
  [15, '{for a new animation|#555555}'],
];

// a line starts 2.8 frames after the one above it and types at 3 chars a frame
const START = 6, STAGGER = 2.8, CPS = 3;
const delay = row => START + (row - LINES[0][0]) * STAGGER;
const typed = (row, f) => Math.floor((f - delay(row)) * CPS);

const rgb = (p, c) => `${p};2;${c[0]};${c[1]};${c[2]}`;
const same = (a, b) => a === b || (!!a && !!b && a[0] === b[0] && a[1] === b[1] && a[2] === b[2]);

// what the cell needs, not what the terminal already holds. a space only needs a background,
// and a half block with nothing under it needs the reset first
const spec = ([ch, fg, bg]) => !fg && !bg ? '0'
  : !fg ? rgb('48', bg)
  : !bg ? '0;' + rgb('38', fg)
  : `${rgb('38', fg)};${rgb('48', bg)}`;

// one escape per run, and the panes never share a run
function row(cells) {
  let out = '', want = null;
  for (const c of cells) {
    const s = spec(c);
    if (s !== want) { out += `\x1b[${s}m`; want = s; }
    out += c[0];
  }
  return out;
}

// how hot a pixel still is t frames in, and which colour it leans on. most cool off white
const cooldown = t => 1 - Math.sqrt(t / FADE);
const STYLE = {
  default: { head: [255, 255, 255], span: FADE, k: cooldown },
  matrix:  { head: [0, 255, 70], span: FADE, k: cooldown },
  // a cyan beam on a longer clock, started partway in so the brightest part never shows
  scanline: { head: [180, 255, 255], span: 7.8 - 2.74, k: t => 1 - Math.sqrt((t + 2.74) / 7.8) },
  bounce:  { head: [255, 255, 255], span: 13,
             k: t => t < 5 ? Math.sin(Math.PI * t / 5) * 0.57
                   : t < 10 ? 0
                   : Math.sin(Math.PI * (t - 10) / 3) * 0.045 },
};

const cool = (c, t, s) => {
  if (t < 0) return null;
  const k = t >= s.span ? 0 : s.k(t);
  return [c[0] + (s.head[0] - c[0]) * k | 0, c[1] + (s.head[1] - c[1]) * k | 0, c[2] + (s.head[2] - c[2]) * k | 0];
};

function imageCell(times, style, f, x, cy) {
  const up = ART[cy * 2][x], lo = ART[cy * 2 + 1][x];
  const top = up && cool(up, f - times[cy * 2][x], style);
  const bot = lo && cool(lo, f - times[cy * 2 + 1][x], style);
  if (!top && !bot) return [' ', null, null];
  if (!top) return ['▄', bot, null];
  if (!bot) return ['▀', top, null];
  return same(top, bot) ? [' ', null, top] : ['▄', bot, top];
}

// never needs a background, so no reset prefix
function textRow(text, f, cy) {
  const line = text.find(l => l[0] === cy);
  const chars = line ? typed(cy, f) : 0;
  if (chars <= 0) return '\x1b[0m' + ' '.repeat(TEXTW);

  let out = '\x1b[0m' + ' '.repeat(GAP), left = chars, width = 0, want = null;
  for (const [str, colour] of spans(line[1])) {
    const part = str.slice(0, left);
    if (!part) break;
    const s = rgb('38', colour);
    if (s !== want) { out += `\x1b[${s}m`; want = s; }
    out += part;
    width += part.length;
    if ((left -= str.length) <= 0) break;
  }
  return `${out}\x1b[0m${' '.repeat(TEXTW - GAP - width)}`;
}

function frame(shot, f) {
  const out = [];
  for (let cy = 0; cy < ROWS; cy++) {
    const img = Array.from({ length: COLS }, (_, x) => imageCell(shot.times, shot.style, f, x, cy));
    out.push(row(img) + textRow(shot.text, f, cy));
  }
  out.push(' '.repeat(COLS + TEXTW));
  return '\x1b[H' + out.join('\n');
}

function build(name) {
  const at = EFFECTS[name]();
  const style = STYLE[name] || STYLE.default;
  const times = ART.map((r, y) => r.map((p, x) => (p ? at(x, y) : 0)));
  const last = Math.max(...times.flat());
  const textEnd = Math.max(...LINES.map(([r, l]) => delay(r) + visible(l) / CPS));
  return { times, text: LINES, style, frames: Math.ceil(Math.max(last + style.span, textEnd)) + 2 };
}

function animate(req, res) {
  const name = pick(req.query.a);
  const shot = build(name);

  res.type('text/plain; charset=utf-8').set({
    'X-Animation': name,
    'X-Accel-Buffering': 'no',
    // no-transform is what makes the compression middleware let go of the stream
    'Cache-Control': 'no-cache, no-transform',
  });
  res.write('\x1b[?25l\x1b[2J\x1b[H');

  let f = 0;
  const tick = setInterval(() => {
    if (f >= shot.frames) {
      clearInterval(tick);
      return res.end('\x1b[24;1H\x1b[?25h');
    }
    res.write(frame(shot, f++));
  }, MS);
  res.on('close', () => clearInterval(tick));
}

module.exports = { animate, hex };

// node --env-file=.env src/routes/cliAnim.js
if (require.main === module) {
  const a = require('assert');

  a.strictEqual(ART.length, 44);
  a.strictEqual(ART[0].length, 40);
  a.ok(ART.flat().filter(Boolean).length > 500, 'art decoded empty');
  a.deepStrictEqual(cool([0, 0, 0], 0, STYLE.default), [255, 255, 255]);  // wakes up white
  a.deepStrictEqual(cool([9, 9, 9], FADE, STYLE.default), [9, 9, 9]);     // and lands on its colour
  a.deepStrictEqual(cool([0, 0, 0], 0, STYLE.matrix), [0, 255, 70]);      // matrix wakes up green
  a.strictEqual(cool([0, 0, 0], -1, STYLE.default), null);
  a.ok(STYLE.bounce.k(2.5) > 0.5 && STYLE.bounce.k(7) === 0);             // pops, rests, echoes
  a.deepStrictEqual(hex('#5ee6a8'), [94, 230, 168]);
  a.deepStrictEqual(hex('#555'), [85, 85, 85]);
  a.deepStrictEqual(spans('a {b|#ff0000} c'), [['a ', FG], ['b', [255, 0, 0]], [' c', FG]]);
  a.strictEqual(row([[' ', null, null]]), '\x1b[0m ');
  a.strictEqual(row([['▄', FG, null], ['▄', FG, null]]), `\x1b[0;${rgb('38', FG)}m▄▄`);
  // a space re-states the background the block before it already set
  const bg = [85, 85, 85];
  a.strictEqual(row([['▄', FG, bg], [' ', null, bg]]),
    `\x1b[${rgb('38', FG)};${rgb('48', bg)}m▄\x1b[${rgb('48', bg)}m `);
  a.strictEqual(textRow([[6, 'hi']], 0, 6), '\x1b[0m' + ' '.repeat(TEXTW));    // nothing typed yet
  a.strictEqual(textRow([[6, 'hi']], 99, 5), '\x1b[0m' + ' '.repeat(TEXTW));   // no line on this row
  a.strictEqual(textRow([[6, 'hi']], 99, 6),
    `\x1b[0m   \x1b[${rgb('38', FG)}mhi\x1b[0m${' '.repeat(TEXTW - GAP - 2)}`);

  // a wider line would push the row past 81 columns
  for (const [, l] of LINES) a.ok(visible(l) <= TEXTW - GAP, `too wide: ${l}`);

  for (const name of NAMES) {
    const shot = build(name);
    a.ok(shot.frames > 30 && shot.frames < 90, `${name} runs for ${shot.frames} frames`);

    const shots = [frame(shot, 0), frame(shot, shot.frames - 1)];
    for (const painted of shots) {
      const rows = painted.slice(3).split('\n');
      a.strictEqual(rows.length, 23, `${name} is not 23 rows`);
      for (const r of rows) a.strictEqual(r.replace(/\x1b\[[0-9;]*m/g, '').length, 81, `${name} is not 81 wide`);
    }
    a.ok(shots[1].includes('curl airzy.ca/cli'), `${name} never finished the text`);
  }

  a.strictEqual(pick('rain'), 'rain');
  for (const q of ['__proto__', 'constructor', 'toString', undefined]) a.ok(NAMES.includes(pick(q)));

  console.log('cliAnim ok,', NAMES.length, 'effects');
}
