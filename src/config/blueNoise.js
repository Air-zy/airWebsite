// blue noise threshold tile for the page background dither in public/js/dither.js, void and cluster (Ulichney 1993).
// every level of it is evenly spread with no grid, so a gradient comes out as fine grain instead of bayer's crosshatch.
// node src/config/blueNoise.js   rewrites public/img/blue-noise.png and checks it. needs node 22.2+ for zlib.crc32
const fs = require('fs');
const zlib = require('zlib');

const N = 64;
const SIGMA = 1.5; // ulichney's pick, smaller clumps and bigger shows the tile

// wraps around so the tile repeats with no seam
const kernel = new Float64Array(N * N);
for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
  const dx = Math.min(x, N - x), dy = Math.min(y, N - y);
  kernel[y * N + x] = Math.exp(-(dx * dx + dy * dy) / (2 * SIGMA * SIGMA));
}

// energy is how crowded each pixel is by the on pixels around it
const on = new Uint8Array(N * N);
const energy = new Float64Array(N * N);
function set(p, v) {
  on[p] = v;
  const px = p % N, py = (p / N) | 0, sign = v ? 1 : -1;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++)
    energy[y * N + x] += sign * kernel[((y - py + N) % N) * N + (x - px + N) % N];
}

// the tightest cluster is the most crowded on pixel, the largest void the least crowded off one
function find(state, crowded) {
  let best = -1;
  for (let p = 0; p < N * N; p++)
    if (on[p] === state && (best < 0 || (crowded ? energy[p] > energy[best] : energy[p] < energy[best]))) best = p;
  return best;
}

// seeded so a rerun writes the same png
let seed = 1;
const rand = () => (seed = seed * 16807 % 2147483647) / 2147483647;

// a random tenth on, then keep moving the tightest cluster into the largest void until it lands where it left
const start = Math.round(N * N / 10);
for (let n = 0; n < start;) {
  const p = Math.floor(rand() * N * N);
  if (!on[p]) set(p, 1), n++;
}
for (;;) {
  const c = find(1, true);
  set(c, 0);
  const v = find(0, false);
  set(v, 1);
  if (v === c) break;
}

const rank = new Int32Array(N * N).fill(-1);
const saved = [on.slice(), energy.slice()];
// below the start, pull the tightest clusters back out
for (let r = start - 1; r >= 0; r--) {
  const c = find(1, true);
  set(c, 0);
  rank[c] = r;
}
on.set(saved[0]);
energy.set(saved[1]);
// above it, fill the largest voids. past half full ulichney switches to the tightest cluster of off pixels,
// that is the same pixel since off crowding is a constant minus on crowding
for (let r = start; r < N * N; r++) {
  const v = find(0, false);
  set(v, 1);
  rank[v] = r;
}

// one gray byte per pixel, the rank scaled to 0 to 255
const row = 1 + N;
const raw = Buffer.alloc(N * row); // filter byte 0 starts each row
for (let p = 0; p < N * N; p++) raw[((p / N) | 0) * row + 1 + p % N] = Math.floor((rank[p] + 0.5) * 256 / (N * N));
function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type), data]);
  const out = Buffer.alloc(body.length + 8);
  out.writeUInt32BE(data.length, 0);
  body.copy(out, 4);
  out.writeUInt32BE(zlib.crc32(body), body.length + 4);
  return out;
}
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(N, 0);
ihdr.writeUInt32BE(N, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 0; // gray
fs.writeFileSync(__dirname + '/../public/img/blue-noise.png', Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
]));

// every rank once, and the sparsest sixteenth has no two pixels touching, random noise would clump there
const a = require('assert');
a.deepStrictEqual([...rank].sort((x, y) => x - y), [...Array(N * N).keys()]);
const sparse = [...rank.keys()].filter(p => rank[p] < N * N / 16);
for (const p of sparse) for (const q of sparse) {
  const dx = Math.min(Math.abs(p % N - q % N), N - Math.abs(p % N - q % N));
  const dy = Math.min(Math.abs(((p / N) | 0) - ((q / N) | 0)), N - Math.abs(((p / N) | 0) - ((q / N) | 0)));
  a.ok(p === q || dx > 1 || dy > 1, 'clumped');
}
console.log('blue noise ok');
