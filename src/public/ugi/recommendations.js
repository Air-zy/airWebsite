/* recommendations.js — rate models, fit a preference model, rank everything else */

const REC_KEY = 'ugi-rec-ratings';
const REC_CLAMP = 5;

let R = {};                  /* model name -> integer rating, non-zero only */
let recLogL = 1;             /* ridge lambda, stored as log10 */
let recHideRated = true;

function recLoad() { try { R = JSON.parse(localStorage.getItem(REC_KEY)) || {}; } catch { R = {}; } }
function recSave() { localStorage.setItem(REC_KEY, JSON.stringify(R)); }
recLoad();

/* Ridge regression of the ratings onto the standardized atomic features:
     w = (Zr'Zr + kI)^-1 Zr'y
   Solved through the eigendecomposition of Zr'Zr so the map's Jacobi routine
   does the linear algebra. No intercept: Z is already globally centered, so
   all-positive ratings still give a "more like these" direction. */
function recFit() {
  const Z = buildZ(), m = MAP_FEATURES.length;
  const rows = [], y = [];
  D.forEach((e, i) => { const r = R[e.model.name]; if (r) { rows.push(Z[i]); y.push(r); } });
  if (!rows.length) return null;

  const A = Array.from({length:m}, () => new Array(m).fill(0));
  const b = new Array(m).fill(0);
  rows.forEach((z, k) => {
    for (let i = 0; i < m; i++) {
      b[i] += z[i] * y[k];
      for (let j = i; j < m; j++) A[i][j] = A[j][i] += z[i] * z[j];
    }
  });

  const lambda = Math.pow(10, recLogL);
  const { eigenvalues, eigenvectors } = _jacobi(A);
  const w = new Array(m).fill(0);
  let dof = 0;
  eigenvalues.forEach((d, k) => {
    const c = _dot(eigenvectors[k], b) / (d + lambda);
    for (let i = 0; i < m; i++) w[i] += c * eigenvectors[k][i];
    dof += d / (d + lambda);
  });
  return { w, dof, lambda, n: rows.length };
}

/* Filtered model indices, in D order */
let _recPos = null;
function recIdx() {
  if (!_recPos) _recPos = new Map(D.map((e, i) => [e, i]));
  return filt().map(e => _recPos.get(e));
}

const recVal = v => v > 0 ? '+' + v : v < 0 ? String(v) : '·';
const recCls = v => v > 0 ? ' pos' : v < 0 ? ' neg' : '';

function renderRec() {
  const el = document.getElementById('v-rec');
  if (!el || !D.length) return;
  el.innerHTML =
    `<div class="rec-bar">` +
      `<span class="rec-stat">rated <b id="rec-n">0</b></span>` +
      `<label class="rec-lab">smoothing <input type="range" id="rec-l" min="-1" max="3" step="0.1" value="${recLogL}"><b id="rec-lv"></b></label>` +
      `<span class="rec-stat" title="Effective degrees of freedom of the fit">dof <b id="rec-dof">–</b></span>` +
      `<button class="fb${recHideRated ? ' on' : ''}" id="rec-hr">HIDE RATED</button>` +
      `<button class="fb" id="rec-clr">CLEAR</button>` +
      `<span class="rec-hint">ridge regression over ${MAP_FEATURES.length} standardized features</span>` +
    `</div>` +
    `<div class="rec-split">` +
      `<div class="rec-pane"><div class="rec-ph">RATE MODELS<span>+ good / − bad, click the number to clear</span></div>` +
        `<div class="rec-scroll"><table><thead><tr><th>MODEL</th><th class="nm">UGI</th><th class="nm">WRITE</th><th class="nm">RATING</th></tr></thead><tbody id="rec-rate"></tbody></table></div></div>` +
      `<div class="rec-pane"><div class="rec-ph">PREFERENCE<span id="rec-cnt"></span></div>` +
        `<div class="rec-scroll"><table><thead><tr><th class="nm">#</th><th>MODEL</th><th class="nm">MATCH</th><th></th></tr></thead><tbody id="rec-pref"></tbody></table></div></div>` +
    `</div>` +
    `<div class="rec-w" id="rec-w"></div>`;

  document.getElementById('rec-l').oninput = function() { recLogL = parseFloat(this.value); recUpdate(); };
  document.getElementById('rec-hr').onclick = function() { recHideRated = !recHideRated; this.classList.toggle('on', recHideRated); recUpdate(); };
  document.getElementById('rec-clr').onclick = () => { R = {}; recSave(); renderRecRate(); recUpdate(); };

  document.getElementById('rec-rate').onclick = ev => {
    const b = ev.target.closest('[data-rd]');
    const tr = ev.target.closest('tr[data-i]');
    if (!tr) return;
    if (!b) { if (ev.target.tagName !== 'A') openDet(D[+tr.dataset.i]); return; }
    const nm = D[+tr.dataset.i].model.name, d = +b.dataset.rd;
    const v = d ? Math.max(-REC_CLAMP, Math.min(REC_CLAMP, (R[nm] || 0) + d)) : 0;
    if (v) R[nm] = v; else delete R[nm];
    recSave();
    const el2 = tr.querySelector('.rec-v');
    el2.textContent = recVal(v);
    el2.className = 'rec-v' + recCls(v);
    tr.classList.toggle('rated', !!v);
    recUpdate();
  };

  document.getElementById('rec-pref').onclick = ev => {
    const tr = ev.target.closest('tr[data-i]');
    if (tr && ev.target.tagName !== 'A') openDet(D[+tr.dataset.i]);
  };

  renderRecRate();
  recUpdate();
}

/* Left pane: everything the current filter allows, own ratings pinned on top */
function renderRecRate() {
  const list = recIdx();
  list.sort((a, b) => {
    const ra = Math.abs(R[D[a].model.name] || 0), rb = Math.abs(R[D[b].model.name] || 0);
    if (!!ra !== !!rb) return rb - ra;
    return (D[b].scores.ugi || -Infinity) - (D[a].scores.ugi || -Infinity);
  });
  document.getElementById('rec-rate').innerHTML = list.map(i => {
    const e = D[i], v = R[e.model.name] || 0;
    return `<tr data-i="${i}"${v ? ' class="rated"' : ''}><td class="nc">${rName(e)}</td>` +
      `<td class="nm">${fN(e.scores.ugi)}</td><td class="nm">${fN(e.scores.writing)}</td>` +
      `<td class="rec-c"><button class="rec-b" data-rd="-1">−</button>` +
      `<span class="rec-v${recCls(v)}" data-rd="0">${recVal(v)}</span>` +
      `<button class="rec-b" data-rd="1">+</button></td></tr>`;
  }).join('');
}

/* Right pane + weight strip, rebuilt on every rating/lambda change */
function recUpdate() {
  const fit = recFit();
  document.getElementById('rec-n').textContent = fit ? fit.n : 0;
  document.getElementById('rec-lv').textContent = fit ? fit.lambda.toFixed(fit.lambda < 1 ? 2 : 1) : '–';
  document.getElementById('rec-dof').textContent = fit ? fit.dof.toFixed(2) : '–';

  const pref = document.getElementById('rec-pref'), wEl = document.getElementById('rec-w');
  if (!fit) {
    pref.innerHTML = `<tr><td colspan="4" class="rec-empty">Rate a few models to build a preference profile.</td></tr>`;
    wEl.innerHTML = '';
    document.getElementById('rec-cnt').textContent = '';
    return;
  }

  const Z = buildZ();
  const rows = recIdx()
    .filter(i => !recHideRated || !R[D[i].model.name])
    .map(i => ({ e: D[i], i, p: _dot(Z[i], fit.w) }))
    .sort((a, b) => b.p - a.p);
  const mx = Math.max(...rows.map(o => Math.abs(o.p)), 1e-9);

  pref.innerHTML = rows.map((o, n) =>
    `<tr data-i="${o.i}"><td class="rk nm">${n + 1}</td><td class="nc">${rName(o.e)}</td>` +
    `<td class="sc nm">${o.p.toFixed(2)}</td>` +
    `<td class="rec-bc"><div class="rec-bf${o.p < 0 ? ' neg' : ''}" style="width:${Math.abs(o.p) / mx * 100}%"></div></td></tr>`
  ).join('');
  document.getElementById('rec-cnt').textContent = `${rows.length} models`;

  const top = MAP_FEATURES.map((f, i) => ({ l: f.l, w: fit.w[i] }))
    .sort((a, b) => Math.abs(b.w) - Math.abs(a.w)).slice(0, 12);
  const wmx = Math.abs(top[0].w) || 1;
  wEl.innerHTML = `<span class="rec-wl">WHAT YOU LIKE</span>` + top.map(t =>
    `<span class="rec-wi${t.w < 0 ? ' neg' : ''}" title="weight ${t.w.toFixed(3)}" style="opacity:${(0.35 + 0.65 * Math.abs(t.w) / wmx).toFixed(2)}">${t.l} ${t.w < 0 ? '−' : '+'}</span>`
  ).join('');
}
