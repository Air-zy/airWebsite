/* leaderboard.js — LB table, column bar, detail drawer */

let D  = [];
let W  = {};
let FF = { finetuned: null, merged: null, foundation: null, thinking: null };
let sC = 'score', sD = -1, exR = null, sq = '', vw = 'lb';
let vC  = new Set(['rank','name','score','ugi','writing','natint','w10','params']);
let aVC = new Set(['ugi','writing','natint','w10','params']);
let rowLimit = 20;
function renderAgg() {}

const vis  = () => CL.filter(c => c.a || vC.has(c.id));

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
  return has ? s : e.scores.ugi;
}

function rName(e) {
  const f = e.model.flags;
  let t = '';
  if (f.finetuned)  t += '<span class="tag t-ft">FT</span>';
  if (f.merged)     t += '<span class="tag t-mg">MRG</span>';
  if (f.thinking)   t += '<span class="tag t-th">THK</span>';
  if (f.foundation) t += '<span class="tag t-fn">BASE</span>';
  const nm = e.model.name || '?';
  const link = e.model.link ? `<a href="${e.model.link}" target="_blank">${nm}</a>` : nm;
  return `<span class="nn">${link}</span><span class="nt">${t}</span>`;
}

/* Viridis colormap — 9 control points */
const _vStops = [
  [0.00, [68,  1,   84]],
  [0.13, [72,  40,  120]],
  [0.25, [62,  73,  137]],
  [0.38, [49,  104, 142]],
  [0.50, [38,  130, 142]],
  [0.63, [53,  183, 121]],
  [0.75, [110, 206, 88]],
  [0.88, [181, 222, 43]],
  [1.00, [253, 231, 37]],
];

function viridis(t) {
  for (let i = 1; i < _vStops.length; i++) {
    const [t0, c0] = _vStops[i - 1], [t1, c1] = _vStops[i];
    if (t <= t1) {
      const f = (t - t0) / (t1 - t0);
      return `rgb(${Math.round(c0[0]+f*(c1[0]-c0[0]))},${Math.round(c0[1]+f*(c1[1]-c0[1]))},${Math.round(c0[2]+f*(c1[2]-c0[2]))})`;
    }
  }
  return 'rgb(253,231,37)';
}

/* Keys where lower value = better rank */
const _lowerBetter = new Set([
  'recipe_err','geo_mae','weight_err','music_mae',
  'len_err','wc_exceeded','sem_red','lex_stuck',
  'showmae','showstd',
]);

let _pct = {};
let _pctActive = {};
let _detEntry = null;
let _cmpMode  = 'all';

function buildPctFor(entries) {
  const result = {};
  for (const key of Object.keys(G)) {
    const vals = entries.map(G[key]).filter(v => typeof v === 'number' && !isNaN(v)).sort((a, b) => a - b);
    if (vals.length) result[key] = vals;
  }
  return result;
}

function buildPctData() {
  _pct = buildPctFor(D);
  _pctActive = _pct;
}

function getPeers(entry) {
  const params = entry.model.params.active;
  const isThinking = entry.model.flags.thinking;
  const pool = D.filter(e => e !== entry && e.model.flags.thinking === isThinking);
  if (isNaN(params)) {
    const noParams = pool.filter(e => isNaN(e.model.params.active));
    return noParams.length ? noParams : pool;
  }
  const withParams = pool.filter(e => !isNaN(e.model.params.active));
  withParams.sort((a, b) => Math.abs(a.model.params.active - params) - Math.abs(b.model.params.active - params));
  return withParams.slice(0, 100);
}

function getPct(key, val) {
  const arr = _pctActive[key];
  if (!arr || isNaN(val)) return null;
  let lo = 0, hi = arr.length;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (arr[mid] < val) lo = mid + 1; else hi = mid; }
  const p = lo / arr.length;
  return _lowerBetter.has(key) ? 1 - p : p;
}

function _dpRow(label, val, key) {
  const fv = typeof val === 'string' ? (val || '–') : fN(val);
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
  const m = e.model, f = m.flags;
  const fl = [f.finetuned&&'FT',f.merged&&'MRG',f.foundation&&'Base',f.thinking&&'Think'].filter(Boolean).join(', ') || '—';
  const gs = [
    {n:'Model', i:[
      ['Arch',     m.architecture||'–',           null],
      ['Params',   fP(m.params.active)+' / '+fP(m.params.total), null],
      ['Flags',    fl,                             null],
      ['Template', m.template||'–',               null],
      ['Released', m.released||'–',               null],
      ['Tested',   m.tested||'–',                 null],
    ]},
    {n:'Scores', i:[
      ['UGI',      e.scores.ugi,            'ugi'],
      ['UGI-W10',  e.scores.ugi_no_w10,     'ugi_no_w10'],
      ['Writing',  e.scores.writing,        'writing'],
      ['NatInt',   e.scores.natint,         'natint'],
      ['W/10',     e.scores.w10.overall,    'w10'],
      ['W/10-D',   e.scores.w10.direct,     'w10d'],
      ['W/10-A',   e.scores.w10.adherence,  'w10a'],
    ]},
    {n:'UGI', i:[
      ['Sensitive',    e.ugi_breakdown.sensitive_info, 'sens'],
      ['Hazardous',    e.ugi_breakdown.hazardous,      'haz'],
      ['Entertain',    e.ugi_breakdown.entertainment,  'ent'],
      ['SocPol',       e.ugi_breakdown.socpol,         'socpol'],
      ['NSFW',         e.ugi_breakdown.nsfw_score,     'nsfw'],
      ['Dark',         e.ugi_breakdown.dark_score,     'dark'],
    ]},
    {n:'NatInt', i:[
      ['Textbook',   e.natint_breakdown.textbook,     'textbook'],
      ['Pop Culture',e.natint_breakdown.pop_culture,  'popculture'],
      ['World Model',e.natint_breakdown.world_model,  'worldmodel'],
      ['Recipe Err', e.natint_breakdown.recipe_err,   'recipe_err'],
      ['Geo MAE',    e.natint_breakdown.geo_mae,      'geo_mae'],
      ['Weight Err', e.natint_breakdown.weight_err,   'weight_err'],
      ['Music MAE',  e.natint_breakdown.music_mae,    'music_mae'],
    ]},
    {n:'Writing', i:[
      ['Style',       e.writing.style_score,          'style'],
      ['Originality', e.writing.originality,          'orig'],
      ['Readability', e.writing.readability_grade,    'readability'],
      ['Dialogue%',   e.writing.dialogue_pct,         'dialogue'],
      ['Verb/Noun',   e.writing.verb_noun_ratio,      'verb_noun'],
      ['Adj/Adv%',    e.writing.adj_adv_pct,          'adj_adv'],
      ['Length Err',  e.writing.length_error_pct,     'len_err'],
      ['WC Exceeded', e.writing.wc_exceeded_pct,      'wc_exceeded'],
      ['Sem Redund',  e.writing.semantic_redundancy,  'sem_red'],
      ['Lex Stuck',   e.writing.lexical_stuckness,    'lex_stuck'],
    ]},
    {n:'ShowRec', i:[
      ['Score',       e.show_rec.score,       'showrec'],
      ['MAE',         e.show_rec.mae,         'showmae'],
      ['Std Dev',     e.show_rec.std_dev,     'showstd'],
      ['Correlation', e.show_rec.correlation, 'showcorr'],
    ]},
    {n:'Political', i:[
      ['Lean',    e.political.lean||'–',           null],
      ['Ideology',e.political.ideology||'–',       null],
      ['Dipl',    e.political.compass.dipl||'–',   null],
      ['Govt',    e.political.compass.govt||'–',   null],
      ['Econ',    e.political.compass.econ||'–',   null],
      ['Scty',    e.political.compass.scty||'–',   null],
    ]},
  ];

  const link = m.link ? `<a href="${m.link}" target="_blank" class="dp-name-link">${m.name||'?'}</a>` : (m.name||'?');
  const peers = getPeers(e);
  const allN  = D.length;

  const cmpBtn = (mode, label, n) =>
    `<button class="dp-cmp-btn${_cmpMode === mode ? ' act' : ''}" data-cmp="${mode}">${label} <span class="dp-cmp-n">${n}</span></button>`;

  let h = `<div class="dp-head"><span class="dp-name">${link}</span><button class="dp-close" onclick="closeDet()">×</button></div>` +
    `<div class="dp-cmp">${cmpBtn('all','All',allN)}${cmpBtn('peers','Peers',peers.length)}</div>` +
    `<div class="dp-body">`;
  for (const g of gs) {
    h += `<div class="dp-grp"><div class="dp-gn">${g.n}</div>`;
    for (const [l, v, key] of g.i) h += _dpRow(l, v, key);
    h += '</div>';
  }
  return h + '</div>';
}

function openDet(e) {
  _detEntry  = e;
  _pctActive = _cmpMode === 'peers' ? buildPctFor(getPeers(e)) : _pct;
  const panel = document.getElementById('det-panel');
  panel.innerHTML = buildDetPanel(e);
  panel.classList.remove('hid');
  panel.querySelectorAll('.dp-cmp-btn').forEach(b => {
    b.onclick = () => {
      _cmpMode = b.dataset.cmp;
      if (_cmpMode === 'peers') {
        _pctActive = buildPctFor(getPeers(_detEntry));
      } else {
        _pctActive = _pct;
      }
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

function hasTypeFilter() {
  return Object.values(FF).some(v => v !== null);
}

/* Render leaderboard table */
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
    const sc  = c.id === sC ? (sD === -1 ? 'sd' : 'sa') : '';
    const wt  = W[c.id] ? ' wt' : '';
    const flt = c.id === 'name' && hasTypeFilter() ? ' flt' : '';
    const hasMenu = c.id === 'name' || (c.cls && c.cls.includes('nm') && G[c.id]);
    const ic = hasMenu ? `<span class="th-ic" data-pop="${c.id}">▾</span>` : '';
    const wb = W[c.id] ? `<span class="th-wb">${W[c.id]}</span>` : '';
    const inner = `<div class="th-inner"><span class="th-lbl" data-c="${c.id}">${c.l}</span>${wb}${ic}</div>`;
    return `<th class="${sc}${wt}${flt} ${c.cls||''}" data-c="${c.id}">${inner}</th>`;
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
      if (c.id === 'params' || c.id === 'total_params') return `<td class="nm">${fP(v)}</td>`;
      if (typeof v === 'string') return `<td>${v || '–'}</td>`;
      return `<td class="${c.cls || 'nm'}">${fN(v)}</td>`;
    }).join('');

    const nm = e.model.name;
    tr.onclick = ev => {
      if (ev.target.tagName === 'A') return;
      if (exR === nm) {
        exR = null;
        tr.classList.remove('ex');
        closeDet();
      } else {
        document.querySelectorAll('#ltb tr.ex').forEach(r => r.classList.remove('ex'));
        exR = nm;
        tr.classList.add('ex');
        openDet(e);
      }
    };
    fr.appendChild(tr);
  });
  tb.innerHTML = '';
  tb.appendChild(fr);
  document.getElementById('status').textContent = `${Math.min(rowLimit, data.length)} / ${data.length} / ${D.length}`;
}

/* Sidebar — permanent column controls with collapsible sections */
const cbCollapsed = new Set(['Info','NatInt','Political','ShowRec','UGI','Writing','params']);

function renderColBar() {
  const bar = document.getElementById('sidebar');
  const groups = {};
  for (const c of CL) {
    if (c.a) continue;
    const g = c.g || 'General';
    if (!groups[g]) groups[g] = [];
    groups[g].push(c);
  }

  let h = `<div class="cb-setting"><span class="cb-setting-l">Rows</span><input type="number" id="cb-rows" class="cb-w" value="${rowLimit}" min="1" max="9999"></div>`;

  const flagDefs = [['thinking','THK'],['finetuned','FT'],['merged','MRG'],['foundation','BASE']];
  h += `<div class="cb-grp"><div class="cb-gn cb-gn-static">Filters</div><div class="cb-flags">`;
  for (const [f, l] of flagDefs) {
    const cls = FF[f] === true ? 'on' : FF[f] === false ? 'off' : '';
    h += `<button class="fb ${cls}" data-f="${f}">${l}</button>`;
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
        h += `<div class="cb-row"><label class="cb-lbl"><input type="checkbox" data-c="${c.id}" ${ck}>${c.l}</label>${isNum ? `<input type="number" step="0.1" class="cb-w${wv ? ' nz' : ''}" data-w="${c.id}" value="${wv}" placeholder="w">` : ''}</div>`;
      }
    }
    h += '</div>';
  }
  h += `<button id="cb-reset">Reset</button>`;
  bar.innerHTML = h;

  bar.querySelector('#cb-rows').oninput = function() {
    rowLimit = parseInt(this.value) || 20;
    renderLB();
  };

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

/* Column picker dropdown (agg view) */
function renderCP() {
  const el = document.getElementById('cpick');
  const items = AF;
  const gr    = {};
  for (const c of items) { const g = c.g || 'General'; if (!gr[g]) gr[g] = []; gr[g].push(c); }

  let h = `<div class="cp-hdr"><span>COLUMNS</span><span id="cp-def">Default</span></div>`;
  for (const [n, cs] of Object.entries(gr)) {
    h += `<div class="cpg"><div class="cpgn">${n}</div>`;
    for (const c of cs) {
      const ck = aVC.has(c.k) ? 'checked' : '';
      h += `<label class="cpi"><input type="checkbox" data-c="${c.k}" ${ck}> ${c.l}</label>`;
    }
    h += '</div>';
  }
  el.innerHTML = h;

  el.querySelectorAll('input[data-c]').forEach(i => i.onchange = () => {
    if (i.checked) aVC.add(i.dataset.c); else aVC.delete(i.dataset.c);
    renderAgg();
  });

  const def = el.querySelector('#cp-def');
  if (def) def.onclick = () => {
    aVC = new Set(['ugi','writing','natint','w10','params']);
    renderCP();
    renderAgg();
  };
}

/* TH popover */
let popCol = null;

function openThPop(colId, icEl) {
  const pop = document.getElementById('thpop');
  if (popCol === colId) { closeThPop(); return; }
  popCol = colId;
  icEl.classList.add('act');

  if (colId === 'name') {
    const labels = { finetuned:'FT', merged:'MRG', foundation:'BASE', thinking:'THK' };
    const btns = Object.entries(labels).map(([f, l]) => {
      const cls = FF[f] === true ? 'on' : FF[f] === false ? 'off' : '';
      return `<button class="fb ${cls}" data-f="${f}">${l}</button>`;
    }).join('');
    pop.innerHTML = `
      <div class="pop-section">
        <div class="pop-label">Filter type</div>
        <div class="pop-filters">${btns}</div>
      </div>
      <div class="pop-clear"><span id="pop-clr">Clear</span></div>`;

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
      FF = { finetuned: null, merged: null, foundation: null, thinking: null };
      closeThPop();
      renderLB();
    };
  } else if (G[colId]) {
    const v = W[colId] || 0;
    const label = CL.find(c => c.id === colId)?.l || colId;
    pop.innerHTML = `
      <div class="pop-section">
        <div class="pop-label">Weight — ${label}</div>
        <div class="pop-weight-row">
          <input type="number" step="0.1" value="${v}" id="pop-win">
        </div>
      </div>
      <div class="pop-clear"><span id="pop-clr">Clear</span></div>`;

    const inp = pop.querySelector('#pop-win');
    inp.oninput = () => {
      const val = parseFloat(inp.value) || 0;
      W[colId] = val;
      inp.classList.toggle('nz', val !== 0);
      renderColBar();
      renderLB();
    };
    pop.querySelector('#pop-clr').onclick = () => {
      delete W[colId];
      closeThPop();
      renderColBar();
      renderLB();
    };
    setTimeout(() => inp.focus(), 0);
  } else {
    popCol = null; return;
  }

  const rect = icEl.getBoundingClientRect();
  pop.style.left = Math.min(rect.left, window.innerWidth - 180) + 'px';
  pop.style.top  = (rect.bottom + 3) + 'px';
  pop.classList.remove('hide');
}

function closeThPop() {
  document.getElementById('thpop').classList.add('hide');
  document.querySelectorAll('.th-ic.act').forEach(e => e.classList.remove('act'));
  popCol = null;
}