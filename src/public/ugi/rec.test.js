/* rec.test.js — node rec.test.js
   Checks the real recFit() from recommendations.js against a synthetic taste
   vector, with the browser globals it needs stubbed out. */

const fs = require('fs'), assert = require('assert');
const dir = __dirname + '/';

/* Lift a single function out of a browser script by brace matching */
function grab(file, name) {
  const s = fs.readFileSync(dir + file, 'utf8'), i = s.indexOf('function ' + name + '(');
  let d = 0;
  for (let k = s.indexOf('{', i); k < s.length; k++) {
    if (s[k] === '{') d++;
    if (s[k] === '}' && !--d) return s.slice(i, k + 1);
  }
}

eval(grab('leaderboard.js', '_jacobi'));
eval(grab('recommendations.js', 'recFit'));
const _dot = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };
const cos = (a, b) => _dot(a, b) / Math.sqrt(_dot(a, a) * _dot(b, b));

/* Synthetic world: 200 models, 12 features, one true taste vector */
const N = 200, M = 12, rnd = (s => () => (s = s * 16807 % 2147483647) / 2147483647)(42);
const Z = Array.from({length:N}, () => Array.from({length:M}, () => rnd() * 2 - 1));
const wTrue = [2, -1.5, 0, 0, 1, 0, 0, -0.5, 0, 0, 0, 0];
const truth = Z.map(z => _dot(z, wTrue));

/* Globals recFit reads */
buildZ = () => Z;
MAP_FEATURES = new Array(M);
D = Z.map((_, i) => ({ model: { name: 'm' + i } }));
R = {};

const rated = [...Array(15).keys()];
rated.forEach(i => R['m' + i] = truth[i]);
const tail = [...Array(N).keys()].slice(15);
const byTrue = [...tail].sort((a, b) => truth[b] - truth[a]).slice(0, 10);

for (const [logL, minCos, minHits] of [[-6, 0.999, 10], [1, 0.85, 5]]) {
  recLogL = logL;
  const f = recFit();
  const hits = [...tail].sort((a, b) => _dot(Z[b], f.w) - _dot(Z[a], f.w))
    .slice(0, 10).filter(i => byTrue.includes(i)).length;
  console.log(`lambda=1e${logL}\tcos=${cos(f.w, wTrue).toFixed(4)}\tdof=${f.dof.toFixed(2)}\ttop10=${hits}/10`);
  assert(cos(f.w, wTrue) >= minCos, 'lost the taste direction');
  assert(hits >= minHits, 'ranking of unrated models drifted');
}

/* dof spans [0, rank]: no shrinkage keeps every direction, heavy shrinkage kills them */
recLogL = -6; assert(Math.abs(recFit().dof - M) < 1e-3, 'dof should equal rank at lambda~0');
recLogL = 9;  assert(recFit().dof < 1e-6, 'dof should vanish at huge lambda');

/* All-positive ratings still aim at the liked cluster (fit has no intercept) */
R = { m3: 1, m7: 1, m11: 1 };
recLogL = 1;
const centroid = Array.from({length:M}, (_, j) => (Z[3][j] + Z[7][j] + Z[11][j]) / 3);
const c = cos(recFit().w, centroid);
console.log('all-+1 -> cos(w, centroid) =', c.toFixed(4));
assert(c > 0.95, 'all-positive ratings should point at the liked models');

console.log('ok');
