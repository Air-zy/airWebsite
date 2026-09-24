/* leaderboard.js — LB table, sidebar, detail panel, map */
/* shared with ../caliper, board specific bits live in each page's config.js */

let D = [];
let W = {};
let FF = { finetuned: null, merged: null, foundation: null, thinking: null, open: null };
let sC = 'score', sD = -1, exR = null, sq = '', vw = 'lb';
let vC;   /* set in init once the data is in */
let rowLimit = 20;

const DATE_KEYS = new Set(['released', 'tested']);

const vis = () => CL.filter(c => c.a || vC.has(c.id));

const filt = () => D.filter(e => {
  if (sq && !(e.model.name || '').toLowerCase().includes(sq)) return false;
  for (const [f, s] of Object.entries(FF)) {
    if (s === true  && !e.model.flags[f]) return false;
    if (s === false &&  e.model.flags[f]) return false;
  }
  return true;
});

function getSc(e) {
  let has = false, s = 0;
  for (const c of CL) {
    const w = W[c.id] || 0;
    if (!w || !G[c.id]) continue;
    const v = G[c.id](e);
    if (typeof v === 'number' && !isNaN(v)) { has = true; s += v * w; }
  }
  return has ? s : G[MAIN](e);
}

const flagText = f => [f.finetuned&&'FT',f.merged&&'MRG',f.foundation&&'Base',f.thinking&&'Think',f.open?'Open':'Proprietary'].filter(Boolean).join(', ');

function rName(e) {
  const f = e.model.flags;
  let t = '';
  if (f.finetuned)  t += '<span class="tag t-ft">FT</span>';
  if (f.merged)     t += '<span class="tag t-mg">MRG</span>';
  if (f.thinking)   t += '<span class="tag t-th">THK</span>';
  if (f.foundation) t += '<span class="tag t-fn">BASE</span>';
  t += f.open
    ? '<span class="tag t-op" title="Open weights">●</span>'
    : '<span class="tag t-cl" title="Proprietary">○</span>';
  const nm = e.model.name || '?';
  const link = e.model.link && e.model.flags.open ? `<a href="${e.model.link}" target="_blank">${nm}</a>` : nm;
  return `<span class="nn">${link}</span><span class="nt">${t}</span>`;
}

const _vStops = [
  [0.00, [68,1,84]],[0.13,[72,40,120]],[0.25,[62,73,137]],[0.38,[49,104,142]],
  [0.50,[38,130,142]],[0.63,[53,183,121]],[0.75,[110,206,88]],[0.88,[181,222,43]],[1.00,[253,231,37]],
];

function viridis(t) {
  for (let i = 1; i < _vStops.length; i++) {
    const [t0, c0] = _vStops[i-1], [t1, c1] = _vStops[i];
    if (t <= t1) {
      const f = (t - t0) / (t1 - t0);
      return `rgb(${Math.round(c0[0]+f*(c1[0]-c0[0]))},${Math.round(c0[1]+f*(c1[1]-c0[1]))},${Math.round(c0[2]+f*(c1[2]-c0[2]))})`;
    }
  }
  return 'rgb(253,231,37)';
}

let _pct = {}, _pctActive = {}, _detEntry = null, _cmpMode = 'all';

function buildPctFor(entries) {
  const r = {};
  for (const key of Object.keys(G)) {
    const vals = entries.map(G[key]).filter(v => typeof v === 'number' && !isNaN(v)).sort((a,b) => a-b);
    if (vals.length) r[key] = vals;
  }
  return r;
}

function buildPctData() { _pct = buildPctFor(D); _pctActive = _pct; }

function getPeers(entry) {
  const params = entry.model.params.active;
  const isThinking = entry.model.flags.thinking;
  const pool = D.filter(e => e !== entry && e.model.flags.thinking === isThinking);
  if (isNaN(params)) {
    const noParams = pool.filter(e => isNaN(e.model.params.active));
    return noParams.length ? noParams : pool;
  }
  const withParams = pool.filter(e => !isNaN(e.model.params.active));
  withParams.sort((a,b) => Math.abs(a.model.params.active - params) - Math.abs(b.model.params.active - params));
  return withParams.slice(0, 100);
}

function getPct(key, val) {
  const arr = _pctActive[key];
  if (!arr || isNaN(val)) return null;
  let lo = 0, hi = arr.length;
  while (lo < hi) { const mid = (lo+hi)>>1; if (arr[mid] < val) lo = mid+1; else hi = mid; }
  const p = lo / arr.length;
  return LOWER_BETTER.has(key) ? 1 - p : p;
}

function _dpRow(label, val, key) {
  let fv;
  if (typeof val === 'string') fv = val || '–';
  else if (DATE_KEYS.has(key)) fv = fDate(val);
  else fv = fN(val);
  const dk = key ? ` data-key="${key}"` : '';
  const dn = (key && typeof val === 'number' && !isNaN(val)) ? ` data-num="${val}"` : '';
  let style = '';
  if (key && typeof val === 'number' && !isNaN(val)) {
    const p = getPct(key, val);
    if (p !== null) style = ` style="color:${viridis(p)}"`;
  }
  return `<div class="dp-row"${dk}><span class="dp-l">${label}</span><span class="dp-v"${dn}${style}>${fv}</span></div>`;
}

function buildDetPanel(e) {
  const m = e.model, gs = detGroups(e);
  const link = (m.link && e.model.flags.open) ? `<a href="${m.link}" target="_blank" class="dp-name-link">${m.name||'?'}</a>` : (m.name||'?');
  const peers = getPeers(e);
  const allN = D.length;
  const cmpBtn = (mode, label, n) =>
    `<button class="dp-cmp-btn${_cmpMode === mode ? ' act' : ''}" data-cmp="${mode}">${label} <span class="dp-cmp-n">${n}</span></button>`;

  let h = `<div class="dp-head"><span class="dp-name">${link}</span><button class="dp-close" onclick="closeDet()">×</button></div>` +
    `<div class="dp-cmp">${cmpBtn('all','All',allN)}${cmpBtn('peers','Peers',peers.length)}</div><div class="dp-body">`;
  for (const g of gs) {
    h += `<div class="dp-grp"><div class="dp-gn">${g.n}</div>`;
    for (const [l, v, key] of g.i) h += _dpRow(l, v, key);
    h += '</div>';
  }
  return h + '</div>';
}

function openDet(e) {
  _detEntry = e;
  _pctActive = _cmpMode === 'peers' ? buildPctFor(getPeers(e)) : _pct;
  const panel = document.getElementById('det-panel');
  panel.innerHTML = buildDetPanel(e);
  panel.classList.remove('hid');
  panel.querySelectorAll('.dp-cmp-btn').forEach(b => {
    b.onclick = () => {
      _cmpMode = b.dataset.cmp;
      _pctActive = _cmpMode === 'peers' ? buildPctFor(getPeers(_detEntry)) : _pct;
      panel.querySelectorAll('.dp-cmp-btn').forEach(x => x.classList.toggle('act', x.dataset.cmp === _cmpMode));
      panel.querySelectorAll('.dp-row[data-key]').forEach(row => {
        const v = parseFloat(row.querySelector('.dp-v')?.dataset.num);
        if (isNaN(v)) return;
        const p = getPct(row.dataset.key, v);
        row.querySelector('.dp-v').style.color = p !== null ? viridis(p) : '';
      });
    };
  });
}

function closeDet() {
  document.getElementById('det-panel').classList.add('hid');
  exR = null;
  document.querySelectorAll('#ltb tr.ex').forEach(r => r.classList.remove('ex'));
}

function modelType(f) {
  if (f.thinking)   return 'Thinking';
  if (f.finetuned)  return 'Finetuned';
  if (f.merged)     return 'Merged';
  if (f.foundation) return 'Foundation';
  return 'Other';
}

function hasTypeFilter() { return Object.values(FF).some(v => v !== null); }

function renderLB() {
  const data = filt(), cols = vis();
  const sd = data.map(e => ({ e, s: getSc(e) }));
  sd.sort((a, b) => {
    let av = sC === 'score' ? a.s : (G[sC] ? G[sC](a.e) : 0);
    let bv = sC === 'score' ? b.s : (G[sC] ? G[sC](b.e) : 0);
    if (typeof av === 'string') return sD * (av || '').localeCompare(bv || '');
    av = isNaN(av) ? -Infinity : av || 0;
    bv = isNaN(bv) ? -Infinity : bv || 0;
    return sD * (av - bv);
  });

  const th = document.getElementById('lth');
  th.innerHTML = '<tr>' + cols.map(c => {
    const sc = c.id === sC ? (sD === -1 ? 'sd' : 'sa') : '';
    const wt = W[c.id] ? ' wt' : '';
    const flt = c.id === 'name' && hasTypeFilter() ? ' flt' : '';
    const hasMenu = c.id === 'name' || (c.cls && c.cls.includes('nm') && G[c.id]);
    const ic = hasMenu ? `<span class="th-ic" data-pop="${c.id}">▾</span>` : '';
    const wb = W[c.id] ? `<span class="th-wb">${W[c.id]}</span>` : '';
    const tip = c.tip ? ` title="${c.tip.replace(/"/g, '&quot;')}"` : '';
    const inner = `<div class="th-inner"><span class="th-lbl" data-c="${c.id}">${c.l}</span>${wb}${ic}</div>`;
    return `<th class="${sc}${wt}${flt} ${c.cls||''}" data-c="${c.id}"${tip}>${inner}</th>`;
  }).join('') + '</tr>';

  const tb = document.getElementById('ltb');
  const fr = document.createDocumentFragment();
  sd.slice(0, rowLimit).forEach(({ e, s }, i) => {
    const tr = document.createElement('tr');
    if (exR === e.model.name) tr.classList.add('ex');
    tr.innerHTML = cols.map(c => {
      if (c.id === 'score') return `<td class="sc nm">${fN(s)}</td>`;
      if (c.id === 'rank')  return `<td class="rk nm">${i + 1}</td>`;
      if (c.id === 'name')  return `<td class="nc">${rName(e)}</td>`;
      const g = G[c.id]; if (!g) return '<td>–</td>';
      const v = g(e);
      if (c.t === 'date') return `<td class="nm">${fDate(v)}</td>`;
      if (c.id === 'params' || c.id === 'total_params') return `<td class="nm">${fP(v)}</td>`;
      if (typeof v === 'string') return `<td>${v || '–'}</td>`;
      return `<td class="${c.cls || 'nm'}">${fN(v)}</td>`;
    }).join('');
    const nm = e.model.name;
    tr.onclick = ev => {
      if (ev.target.tagName === 'A') return;
      if (exR === nm) { exR = null; tr.classList.remove('ex'); closeDet(); }
      else {
        document.querySelectorAll('#ltb tr.ex').forEach(r => r.classList.remove('ex'));
        exR = nm; tr.classList.add('ex'); openDet(e);
      }
    };
    fr.appendChild(tr);
  });
  tb.innerHTML = '';
  tb.appendChild(fr);
  document.getElementById('status').textContent = `${data.length} / ${D.length}`;
}

let cbCollapsed = null;

function renderColBar() {
  const bar = document.getElementById('sidebar');
  const groups = {};
  for (const c of CL) {
    if (c.a) continue;
    const g = c.g || 'General';
    if (!groups[g]) groups[g] = [];
    groups[g].push(c);
  }
  /* Only the first group starts open */
  cbCollapsed ??= new Set(Object.keys(groups).slice(1));

  let h = `<div class="cb-setting"><span class="cb-setting-l">Rows</span><input type="number" id="cb-rows" class="cb-w" value="${rowLimit}" min="1" max="9999"></div>`;

  const flagDefs = [
    ['thinking','THK','Thinking model'],
    ['finetuned','FT','Finetuned'],
    ['merged','MRG','Merged'],
    ['foundation','BASE','Foundation model'],
    ['open','OPEN','Open weights (has downloadable model card)'],
  ];
  h += `<div class="cb-grp"><div class="cb-gn cb-gn-static">Filters</div><div class="cb-flags">`;
  for (const [f, l, tip] of flagDefs) {
    const cls = FF[f] === true ? 'on' : FF[f] === false ? 'off' : '';
    h += `<button class="fb ${cls}" data-f="${f}" title="${tip} (click: only • click again: exclude)">${l}</button>`;
  }
  h += `</div></div>`;

  for (const [gname, cols] of Object.entries(groups)) {
    const open = !cbCollapsed.has(gname);
    h += `<div class="cb-grp"><div class="cb-gn" data-grp="${gname}">${gname}<span class="cb-arr">${open ? '▾' : '▸'}</span></div>`;
    if (open) {
      for (const c of cols) {
        const ck = vC.has(c.id) ? 'checked' : '';
        const isNum = c.cls?.includes('nm');
        const wv = W[c.id] || '';
        const tip = c.tip ? ` title="${c.tip.replace(/"/g, '&quot;')}"` : '';
        h += `<div class="cb-row"${tip}><label class="cb-lbl"><input type="checkbox" data-c="${c.id}" ${ck}>${c.l}</label>${isNum ? `<input type="number" step="0.1" class="cb-w${wv ? ' nz' : ''}" data-w="${c.id}" value="${wv}" placeholder="w">` : ''}</div>`;
      }
    }
    h += '</div>';
  }
  h += `<button id="cb-reset">Reset</button>`;
  bar.innerHTML = h;

  bar.querySelector('#cb-rows').oninput = function() { rowLimit = parseInt(this.value) || 20; renderLB(); };

  bar.querySelectorAll('.fb[data-f]').forEach(b => b.onclick = () => {
    const f = b.dataset.f;
    if (FF[f] === null)      { FF[f] = true;  b.className = 'fb on'; }
    else if (FF[f] === true) { FF[f] = false; b.className = 'fb off'; }
    else                     { FF[f] = null;  b.className = 'fb'; }
    renderLB();
  });

  bar.querySelectorAll('.cb-gn[data-grp]').forEach(el => el.onclick = () => {
    const g = el.dataset.grp;
    if (cbCollapsed.has(g)) cbCollapsed.delete(g); else cbCollapsed.add(g);
    renderColBar();
  });

  bar.querySelectorAll('input[data-c]').forEach(i => i.onchange = () => {
    if (i.checked) vC.add(i.dataset.c); else vC.delete(i.dataset.c);
    renderLB();
  });

  bar.querySelectorAll('input[data-w]').forEach(i => i.oninput = () => {
    const v = parseFloat(i.value) || 0;
    if (v) W[i.dataset.w] = v; else delete W[i.dataset.w];
    i.classList.toggle('nz', v !== 0);
    renderLB();
  });
}

let popCol = null;

function openThPop(colId, icEl) {
  const pop = document.getElementById('thpop');
  if (popCol === colId) { closeThPop(); return; }
  popCol = colId;
  icEl.classList.add('act');

  if (colId === 'name') {
    const labels = { finetuned:'FT', merged:'MRG', foundation:'BASE', thinking:'THK', open:'OPEN' };
    const tips = { finetuned:'Finetuned', merged:'Merged', foundation:'Foundation', thinking:'Thinking model', open:'Open weights' };
    const btns = Object.entries(labels).map(([f, l]) => {
      const cls = FF[f] === true ? 'on' : FF[f] === false ? 'off' : '';
      return `<button class="fb ${cls}" data-f="${f}" title="${tips[f]}">${l}</button>`;
    }).join('');
    pop.innerHTML = `<div class="pop-section"><div class="pop-label">Filter type</div><div class="pop-filters">${btns}</div></div><div class="pop-clear"><span id="pop-clr">Clear</span></div>`;
    pop.querySelectorAll('.fb[data-f]').forEach(b => {
      b.onclick = () => {
        const f = b.dataset.f;
        if (FF[f] === null)       { FF[f] = true;  b.classList.add('on');  b.classList.remove('off'); }
        else if (FF[f] === true)  { FF[f] = false; b.classList.remove('on'); b.classList.add('off'); }
        else                      { FF[f] = null;  b.classList.remove('on','off'); }
        renderLB();
      };
    });
    pop.querySelector('#pop-clr').onclick = () => {
      FF = { finetuned: null, merged: null, foundation: null, thinking: null, open: null };
      closeThPop(); renderLB();
    };
  } else if (G[colId]) {
    const v = W[colId] || 0;
    const label = CL.find(c => c.id === colId)?.l || colId;
    const tip = CL.find(c => c.id === colId)?.tip || '';
    pop.innerHTML = `<div class="pop-section"><div class="pop-label">Weight — ${label}</div>${tip ? `<div class="pop-tip">${tip}</div>` : ''}<div class="pop-weight-row"><input type="number" step="0.1" value="${v}" id="pop-win"></div></div><div class="pop-clear"><span id="pop-clr">Clear</span></div>`;
    const inp = pop.querySelector('#pop-win');
    inp.oninput = () => {
      const val = parseFloat(inp.value) || 0;
      W[colId] = val;
      inp.classList.toggle('nz', val !== 0);
      renderColBar(); renderLB();
    };
    pop.querySelector('#pop-clr').onclick = () => {
      delete W[colId]; closeThPop(); renderColBar(); renderLB();
    };
    setTimeout(() => inp.focus(), 0);
  } else { popCol = null; return; }

  const rect = icEl.getBoundingClientRect();
  pop.style.left = Math.min(rect.left, window.innerWidth - 180) + 'px';
  pop.style.top = (rect.bottom + 3) + 'px';
  pop.classList.remove('hide');
}

function closeThPop() {
  document.getElementById('thpop').classList.add('hide');
  document.querySelectorAll('.th-ic.act').forEach(e => e.classList.remove('act'));
  popCol = null;
}

/* -- Shared chart scaffolding (Chart + Map views) -- */

const TYPE_COLORS = { Thinking:'#e05c5c', Finetuned:'#a88fe0', Merged:'#5db87a', Foundation:'#5ca8d8', Other:'#686862' };
const TYPE_ORDER  = ['Thinking','Finetuned','Merged','Foundation','Other'];

/* Date columns hold the fractional years pDate returns, label them year-month */
const numToDateLbl = v => { const d = new Date(DATE_EPOCH_MS + v * MS_PER_YEAR); return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0'); };

/* Read on use, caliper only knows its columns once the data is in */
const axisCols  = () => CL.filter(c => G[c.id] && c.cls?.includes('nm'));
const axisLabel = k => axisCols().find(c => c.id === k)?.l || k;
const fmtAxisV  = (k, v) => DATE_KEYS.has(k) ? numToDateLbl(v) : fN(v);

function axisOptHTML(sel) {
  const gr = {};
  for (const c of axisCols()) (gr[c.g || 'Other'] ??= []).push(c);
  return Object.entries(gr).map(([g, cols]) =>
    `<optgroup label="${g}">${cols.map(c => `<option value="${c.id}"${c.id === sel ? ' selected' : ''}>${c.l}</option>`).join('')}</optgroup>`
  ).join('');
}

const SS   = 'background:var(--bg3);border:1px solid var(--bd);color:var(--t);font:11px IBM Plex Mono,monospace;padding:3px 5px;outline:none';
const btnS = on => `background:${on?'var(--ac)':'var(--bg3)'};border:1px solid ${on?'var(--ac)':'transparent'};color:${on?'var(--bg)':'var(--t2)'};font:${on?600:500} 10px IBM Plex Mono,monospace;padding:3px 9px;cursor:pointer`;

const CH_FONT   = { family:'IBM Plex Mono', size:9 };
const CH_LEGEND = { labels: { color:'#686862', font: CH_FONT, boxWidth:8, padding:12 } };
const CH_TIP    = { backgroundColor:'#131315', borderColor:'#303035', borderWidth:1, titleColor:'#ccccc4', bodyColor:'#686862', displayColors:false };
const CH_AXIS   = { grid: { color:'#252528' }, ticks: { color:'#686862', font: CH_FONT } };

function updateColorUI(isCol) {
  document.getElementById('cm-type').setAttribute('style', btnS(!isCol));
  document.getElementById('cm-col').setAttribute('style', btnS(isCol));
  document.getElementById('z-wrap').style.display = isCol ? 'flex' : 'none';
  document.getElementById('z-legend').style.display = isCol ? 'flex' : 'none';
}

/* One dataset per model type */
function typeDatasets(pts, r) {
  const by = {};
  for (const p of pts) (by[modelType(p.e.model.flags)] ??= []).push(p);
  return TYPE_ORDER.filter(t => by[t]).map(t => ({
    label: t, data: by[t], backgroundColor: TYPE_COLORS[t] + 'b3',
    pointRadius: r, pointHoverRadius: r + 2, pointBorderWidth: 0,
  }));
}

/* Single dataset shaded by the Z column, plus its gradient legend */
function colorDataset(pts, zKey, r) {
  const zs = pts.map(p => { const z = G[zKey]?.(p.e); return (typeof z === 'number' && !isNaN(z)) ? z : null; });
  const vals = zs.filter(v => v !== null);
  const lo = vals.length ? Math.min(...vals) : 0, hi = vals.length ? Math.max(...vals) : 1;
  const rng = hi - lo || 1;
  const grad = [0,.25,.5,.75,1].map(t => `${viridis(t)} ${t*100}%`).join(',');
  const leg = document.getElementById('z-legend');
  if (leg) leg.innerHTML = `<span class="cap">${axisLabel(zKey)}</span><span>${fmtAxisV(zKey, lo)}</span>` +
    `<div class="z-grad" style="background:linear-gradient(to right,${grad})"></div><span>${fmtAxisV(zKey, hi)}</span>`;
  return {
    label: axisLabel(zKey),
    data: pts.map((p, i) => ({ ...p, z: zs[i] })),
    backgroundColor: zs.map(z => z !== null ? viridis((z - lo) / rng) : 'rgba(80,80,80,.35)'),
    pointRadius: r, pointHoverRadius: r + 2, pointBorderWidth: 0,
  };
}

/* -- Map view: PCA on atomic features -- */

function _colStds(M, means) {
  const n = M.length, m = M[0].length;
  const vars = new Array(m).fill(0);
  for (const row of M) for (let j = 0; j < m; j++) { const d = row[j] - means[j]; vars[j] += d * d; }
  return vars.map(v => { const s = Math.sqrt(v / Math.max(1, n-1)); return s || 1; });
}

function _covariance(Z) {
  const n = Z.length, m = Z[0].length;
  const cov = Array.from({length:m}, () => new Array(m).fill(0));
  for (let i = 0; i < m; i++) for (let j = i; j < m; j++) {
    let s = 0;
    for (let k = 0; k < n; k++) s += Z[k][i] * Z[k][j];
    cov[i][j] = cov[j][i] = s / Math.max(1, n-1);
  }
  return cov;
}

function _dot(a, b) { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; }

/* needs about n² rotations, a flat 200 left 38 features unconverged */
function _jacobi(A, maxIter = 20 * A.length ** 2, eps = 1e-12) {
  const n = A.length;
  const M = A.map(r => r.slice());
  const V = Array.from({length:n}, (_, i) => { const r = new Array(n).fill(0); r[i] = 1; return r; });
  for (let iter = 0; iter < maxIter; iter++) {
    let p = 0, q = 1, max = 0;
    for (let i = 0; i < n; i++) for (let j = i+1; j < n; j++) { const v = Math.abs(M[i][j]); if (v > max) { max = v; p = i; q = j; } }
    if (max < eps) break;
    const app = M[p][p], aqq = M[q][q], apq = M[p][q];
    const phi = Math.abs(app - aqq) < 1e-30 ? Math.PI/4 : 0.5 * Math.atan2(2*apq, aqq-app);
    const c = Math.cos(phi), s = Math.sin(phi);
    for (let i = 0; i < n; i++) if (i !== p && i !== q) {
      const mip = M[i][p], miq = M[i][q];
      M[i][p] = M[p][i] = c*mip - s*miq;
      M[i][q] = M[q][i] = s*mip + c*miq;
    }
    M[p][p] = c*c*app - 2*s*c*apq + s*s*aqq;
    M[q][q] = s*s*app + 2*s*c*apq + c*c*aqq;
    M[p][q] = M[q][p] = 0;
    for (let i = 0; i < n; i++) {
      const vip = V[i][p], viq = V[i][q];
      V[i][p] = c*vip - s*viq;
      V[i][q] = s*vip + c*viq;
    }
  }
  const eigenvalues = M.map((row, i) => row[i]);
  const eigenvectors = eigenvalues.map((_, k) => V.map(row => row[k]));
  return { eigenvalues, eigenvectors };
}

/* Standardized atomic-feature matrix, missing values imputed to the column mean.
   Built once, shared by the map PCA and the recommendation model. */
let _Z = null;

function buildZ() {
  if (_Z) return _Z;
  const m = MAP_FEATURES.length;
  const colVals = Array.from({length:m}, () => []);
  const M = D.map(e => MAP_FEATURES.map((f, j) => {
    const v = f.get(e);
    if (typeof v === 'number' && !isNaN(v)) colVals[j].push(v);
    return v;
  }));
  const colMeans = colVals.map(vs => vs.length ? vs.reduce((a,b) => a+b, 0) / vs.length : 0);
  for (let i = 0; i < M.length; i++) for (let j = 0; j < m; j++)
    if (typeof M[i][j] !== 'number' || isNaN(M[i][j])) M[i][j] = colMeans[j];
  const stds = _colStds(M, colMeans);
  _Z = M.map(row => row.map((v, j) => (v - colMeans[j]) / stds[j]));
  return _Z;
}

function computeMapPCA() {
  const Z = buildZ();
  const cov = _covariance(Z);
  const { eigenvalues, eigenvectors } = _jacobi(cov);
  const order = eigenvalues.map((v, i) => i).sort((a, b) => eigenvalues[b] - eigenvalues[a]);
  const v1 = eigenvectors[order[0]], v2 = eigenvectors[order[1]];
  const points = Z.map((row, i) => ({ x: _dot(row, v1), y: _dot(row, v2), e: D[i] }));
  const totalVar = eigenvalues.reduce((a, b) => a + b, 0) || 1;
  const loadingsFor = (vec) => MAP_FEATURES.map((f, i) => ({ label: f.l, loading: vec[i] }))
    .sort((a, b) => Math.abs(b.loading) - Math.abs(a.loading)).slice(0, 5);
  return {
    points, Z, eigenvalues, eigenvectors, order, totalVar,
    topLoadings: { pc1: loadingsFor(v1), pc2: loadingsFor(v2) },
  };
}

let _mapChart = null;
let _mapDraw = null;
let _mapSearch = '';

function mapShortName(full) {
  return full.replace(/^[^\s/()]+\//, '');   /* only a leading author/, not a slash inside (a/b) */
}

function renderMap() {
  const el = document.getElementById('v-map');
  if (!el) return;
  _mapSearch = document.getElementById('search').value;

  /* Drop any stale chart from a previous render (e.g. after visiting Chart view) */
  if (_mapChart) { _mapChart.destroy(); _mapChart = null; }

  const pca = computeMapPCA();
  const pcCount = Math.min(6, pca.order.length);
  const pcOptHTML = sel => { let h = ''; for (let i = 0; i < pcCount; i++) { const v = (pca.eigenvalues[pca.order[i]] / pca.totalVar * 100).toFixed(1); h += `<option value="${i+1}"${i+1 === sel ? ' selected' : ''}>PC${i+1} (${v}%)</option>`; } return h; };

  let xPC = 1, yPC = 2, zKey = MAIN, colorMode = 'type', showLabels = true;

  el.innerHTML =
    `<div class="ctrl-bar">` +
      `<span class="ctrl-title">Similarity Map</span>` +
      `<span class="ctrl-sub">${MAP_FEATURES.length} atomic · ${D.length} models · PCA</span>` +
      `<label class="ctrl">X <select id="pc-x" style="${SS}">${pcOptHTML(1)}</select></label>` +
      `<label class="ctrl">Y <select id="pc-y" style="${SS}">${pcOptHTML(2)}</select></label>` +
      `<span class="cap">Color</span>` +
      `<button id="cm-type" style="${btnS(true)}">Type</button>` +
      `<button id="cm-col" style="${btnS(false)}">Column</button>` +
      `<label id="z-wrap" class="ctrl" style="display:none">Z <select id="sc-z" style="${SS}">${axisOptHTML(MAIN)}</select></label>` +
      `<button id="map-labels" style="${btnS(true)}">Labels</button>` +
      `<button id="map-reset" style="${btnS(false)}">Reset view</button>` +
      `<span class="ctrl-r">scroll zoom · drag pan · click details</span>` +
    `</div>` +
    `<div class="map-canvas-wrap"><canvas id="map-cv"></canvas><div class="map-loadings" id="map-loadings"></div></div>` +
    `<div id="z-legend" class="z-legend"></div>`;

  const getPCVec = n => pca.eigenvectors[pca.order[n-1]];
  const getPCVar = n => pca.eigenvalues[pca.order[n-1]] / pca.totalVar;
  const loadingsForPC = n => {
    const vec = getPCVec(n);
    return MAP_FEATURES.map((f, i) => ({ label: f.l, loading: vec[i] }))
      .sort((a, b) => Math.abs(b.loading) - Math.abs(a.loading)).slice(0, 5);
  };

  function updateLoadings() {
    const el2 = document.getElementById('map-loadings');
    if (!el2) return;
    const mk = (pc, n) => `<div class="map-load-pc"><span class="map-load-pc-name">PC${n} ${pc === xPC ? '←→' : '↑↓'}</span>${loadingsForPC(pc).map(l => `<span class="map-load-item" title="${l.label}: ${l.loading.toFixed(3)}">${l.label}${l.loading > 0 ? ' +' : ' −'}</span>`).join('')}</div>`;
    el2.innerHTML = mk(xPC, xPC) + mk(yPC, yPC);
  }


  function buildDatasets() {
    const vx = getPCVec(xPC), vy = getPCVec(yPC);
    const pts = pca.Z.map((row, i) => ({ x: _dot(row, vx), y: _dot(row, vy), e: D[i] }));
    const datasets = colorMode === 'type' ? typeDatasets(pts, 2.5) : [colorDataset(pts, zKey, 2.5)];
    if (_mapSearch) {
      const lq = _mapSearch.toLowerCase();
      const hit = p => (p.e.model.name || '').toLowerCase().includes(lq);
      for (const ds of datasets) {
        ds.pointRadius = ds.data.map(p => hit(p) ? 7 : 1.5);
        ds.pointHoverRadius = ds.data.map(p => hit(p) ? 9 : 3);
      }
    }
    return datasets;
  }

  const mapLabelsPlugin = {
    id: 'mapLabels',
    afterDatasetsDraw(chart) {
      if (!showLabels) return;
      const ctx = chart.ctx;
      const items = [];
      for (let d = 0; d < chart.data.datasets.length; d++) {
        const m = chart.getDatasetMeta(d);
        if (!m || m.hidden) continue;
        const ds = chart.data.datasets[d];
        for (let i = 0; i < m.data.length; i++) {
          const pt = m.data[i];
          if (!pt || pt.skip) continue;
          const raw = ds.data[i];
          const fullName = raw.e?.model?.name || '?';
          const main = raw.e ? G[MAIN](raw.e) : NaN;
          const isMatch = _mapSearch && fullName.toLowerCase().includes(_mapSearch.toLowerCase());
          items.push({
            x: pt.x, y: pt.y,
            name: mapShortName(fullName),
            main: typeof main === 'number' && !isNaN(main) ? main : -Infinity,
            isMatch,
            visible: pt.x >= -50 && pt.x <= chart.width + 50 && pt.y >= -50 && pt.y <= chart.height + 50,
          });
        }
      }
      items.sort((a, b) => { if (a.isMatch !== b.isMatch) return a.isMatch ? -1 : 1; return b.main - a.main; });
      ctx.save();
      ctx.font = '9px "IBM Plex Mono", monospace';
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';
      const padX = 3, padY = 1, minSpacing = 2;
      const placed = [];
      for (const it of items) {
        if (!it.visible) continue;
        const lw = ctx.measureText(it.name).width + 2 * padX;
        const lh = 9 + 2 * padY;
        let lx = it.x + 5;
        if (lx + lw > chart.width - 2) lx = it.x - 5 - lw;
        const ly = it.y - lh / 2;
        let collides = false;
        for (const r of placed) {
          if (lx < r.x + r.w + minSpacing && lx + lw + minSpacing > r.x &&
              ly < r.y + r.h + minSpacing && ly + lh + minSpacing > r.y) { collides = true; break; }
        }
        if (collides && !it.isMatch) continue;
        ctx.fillStyle = it.isMatch ? getComputedStyle(document.body).getPropertyValue('--ac') : 'rgba(19,19,21,0.82)';
        ctx.fillRect(lx, ly, lw, lh);
        if (!it.isMatch) { ctx.strokeStyle = 'rgba(48,48,53,0.6)'; ctx.lineWidth = 1; ctx.strokeRect(lx, ly, lw, lh); }
        ctx.fillStyle = it.isMatch ? '#131315' : '#ccccc4';
        ctx.fillText(it.name, lx + padX, ly + lh / 2);
        placed.push({ x: lx, y: ly, w: lw, h: lh });
      }
      ctx.restore();
    },
  };

  function draw() {
    const datasets = buildDatasets();
    const xVar = getPCVar(xPC), yVar = getPCVar(yPC);
    if (_mapChart) {
      _mapChart.data.datasets = datasets;
      _mapChart.options.plugins.legend.display = colorMode === 'type';
      _mapChart.options.scales.x.title.text = `PC${xPC} (${(xVar*100).toFixed(1)}%)`;
      _mapChart.options.scales.y.title.text = `PC${yPC} (${(yVar*100).toFixed(1)}%)`;
      _mapChart.update('none');
    } else {
      _mapChart = new Chart(document.getElementById('map-cv'), {
        type: 'scatter',
        data: { datasets },
        plugins: [mapLabelsPlugin],
        options: {
          animation: false,
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: colorMode === 'type' ? CH_LEGEND : { display: false },
            tooltip: {
              ...CH_TIP, mode: 'nearest', intersect: true,
              callbacks: {
                title: ctx => ctx[0].raw.e.model.name,
                label: ctx => (colorMode !== 'column' || ctx.raw.z === null) ? ''
                  : `${axisLabel(zKey)}: ${fmtAxisV(zKey, ctx.raw.z)}`,
              },
            },
            zoom: {
              pan: { enabled: true, mode: 'xy' },
              zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: 'xy' },
            },
          },
          onClick: (_, elements) => {
            if (elements.length && _mapChart) {
              const ds = _mapChart.data.datasets[elements[0].datasetIndex];
              openDet(ds.data[elements[0].index].e);
            }
          },
          scales: {
            x: { ...CH_AXIS, title: { display: true, text: `PC${xPC} (${(xVar*100).toFixed(1)}%)`, color: '#686862', font: CH_FONT } },
            y: { ...CH_AXIS, title: { display: true, text: `PC${yPC} (${(yVar*100).toFixed(1)}%)`, color: '#686862', font: CH_FONT } },
          },
        },
      });
    }
  }

  _mapDraw = draw;
  document.getElementById('pc-x').onchange = function() { xPC = parseInt(this.value); updateLoadings(); draw(); };
  document.getElementById('pc-y').onchange = function() { yPC = parseInt(this.value); updateLoadings(); draw(); };
  document.getElementById('cm-type').onclick = () => { colorMode = 'type';   updateColorUI(false); draw(); };
  document.getElementById('cm-col').onclick  = () => { colorMode = 'column'; updateColorUI(true);  draw(); };
  document.getElementById('sc-z').onchange = function() { zKey = this.value; draw(); };
  document.getElementById('map-labels').onclick = function() {
    showLabels = !showLabels;
    this.setAttribute('style', btnS(showLabels));
    if (_mapChart) _mapChart.update('none');
  };
  document.getElementById('map-reset').onclick = () => {
    if (_mapChart && typeof _mapChart.resetZoom === 'function') _mapChart.resetZoom();
  };
  updateLoadings();
  draw();
}
