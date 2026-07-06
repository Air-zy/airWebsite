/* leaderboard.js — LB table, sidebar, detail panel, map */

let D = [];
let W = {};
let FF = { finetuned: null, merged: null, foundation: null, thinking: null, open: null };
let sC = 'score', sD = -1, exR = null, sq = '', vw = 'lb';
let vC = new Set(['rank','name','score','ugi','writing','natint','w10','params']);
let aVC = new Set(['ugi','writing','natint','w10','params']);
let rowLimit = 20;
function renderAgg() {}

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
  return has ? s : e.scores.ugi;
}

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

const _lowerBetter = new Set([
  'recipe_err','geo_mae','weight_err','music_mae',
  'len_err','wc_exceeded','sem_red','lex_stuck','showmae','showstd',
]);

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
  return _lowerBetter.has(key) ? 1 - p : p;
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
  const m = e.model, f = m.flags;
  const fl = [f.finetuned&&'FT',f.merged&&'MRG',f.foundation&&'Base',f.thinking&&'Think',f.open?'Open':'Proprietary'].filter(Boolean).join(', ') || '—';
  const gs = [
    {n:'Model', i:[
      ['Arch', m.architecture||'–', null],
      ['Params', fP(m.params.active)+' / '+fP(m.params.total), null],
      ['Flags', fl, null],
      ['Template', m.template||'–', null],
      ['Released', pDate(m.released), 'released'],
      ['Tested', pDate(m.tested), 'tested'],
    ]},
    {n:'Scores', i:[
      ['UGI', e.scores.ugi, 'ugi'],
      ['UGI-W10', e.scores.ugi_no_w10, 'ugi_no_w10'],
      ['Writing', e.scores.writing, 'writing'],
      ['NatInt', e.scores.natint, 'natint'],
      ['W/10', e.scores.w10.overall, 'w10'],
      ['W/10-D', e.scores.w10.direct, 'w10d'],
      ['W/10-A', e.scores.w10.adherence, 'w10a'],
    ]},
    {n:'UGI', i:[
      ['Sensitive', e.ugi_breakdown.sensitive_info, 'sens'],
      ['Hazardous', e.ugi_breakdown.hazardous, 'haz'],
      ['Entertain', e.ugi_breakdown.entertainment, 'ent'],
      ['SocPol', e.ugi_breakdown.socpol, 'socpol'],
      ['NSFW', e.ugi_breakdown.nsfw_score, 'nsfw'],
      ['Dark', e.ugi_breakdown.dark_score, 'dark'],
    ]},
    {n:'NatInt', i:[
      ['Textbook', e.natint_breakdown.textbook, 'textbook'],
      ['Pop Culture', e.natint_breakdown.pop_culture, 'popculture'],
      ['World Model', e.natint_breakdown.world_model, 'worldmodel'],
      ['Recipe Err', e.natint_breakdown.recipe_err, 'recipe_err'],
      ['Geo MAE', e.natint_breakdown.geo_mae, 'geo_mae'],
      ['Weight Err', e.natint_breakdown.weight_err, 'weight_err'],
      ['Music MAE', e.natint_breakdown.music_mae, 'music_mae'],
    ]},
    {n:'Writing', i:[
      ['Style', e.writing.style_score, 'style'],
      ['Originality', e.writing.originality, 'orig'],
      ['Readability', e.writing.readability_grade, 'readability'],
      ['Dialogue%', e.writing.dialogue_pct, 'dialogue'],
      ['Verb/Noun', e.writing.verb_noun_ratio, 'verb_noun'],
      ['Adj/Adv%', e.writing.adj_adv_pct, 'adj_adv'],
      ['Length Err', e.writing.length_error_pct, 'len_err'],
      ['WC Exceeded', e.writing.wc_exceeded_pct, 'wc_exceeded'],
      ['Sem Redund', e.writing.semantic_redundancy, 'sem_red'],
      ['Lex Stuck', e.writing.lexical_stuckness, 'lex_stuck'],
    ]},
    {n:'ShowRec', i:[
      ['Score', e.show_rec.score, 'showrec'],
      ['MAE', e.show_rec.mae, 'showmae'],
      ['Std Dev', e.show_rec.std_dev, 'showstd'],
      ['Correlation', e.show_rec.correlation, 'showcorr'],
    ]},
    {n:'Political', i:[
      ['Lean %', e.political.lean, 'lean'],
      ['Ideology', e.political.ideology||'–', null],
      ['Diplomacy%', e.political.compass.dipl, 'dipl'],
      ['Govt%', e.political.compass.govt, 'govt'],
      ['Econ%', e.political.compass.econ, 'econ'],
      ['Society%', e.political.compass.scty, 'scty'],
    ]},
  ];

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
  document.getElementById('status').textContent = `${Math.min(rowLimit, data.length)} / ${data.length} / ${D.length}`;
}

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

function renderCP() {
  const el = document.getElementById('cpick');
  const gr = {};
  for (const c of AF) { const g = c.g || 'General'; if (!gr[g]) gr[g] = []; gr[g].push(c); }
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
    renderCP(); renderAgg();
  };
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

/* ── About the Benchmarks ── */

const IDEOLOGY_DESCRIPTIONS = {
  'Centrism': 'Centrism is a political outlook or position that involves acceptance and/or support of a balance of social equality and a degree of social hierarchy, while opposing political changes which would result in a significant shift of society strongly to either the left or the right.',
  'Classical Liberalism': 'Classical liberalism is a political ideology and a branch of liberalism that advocates civil liberties under the rule of law with an emphasis on economic freedom. It drew on classical economics, especially the economic ideas as espoused by Adam Smith in Book One of The Wealth of Nations and on a belief in natural law, progress and utilitarianism.',
  'Liberalism': 'Liberalism is a political and moral philosophy based on liberty, consent of the governed and equality before the law. Liberals espouse a wide array of views depending on their understanding of these principles, but they generally support free markets, free trade, limited government, individual rights (including civil rights and human rights), capitalism, democracy, secularism, gender equality, racial equality, internationalism, freedom of speech, freedom of the press and freedom of religion.',
  'Moderate Conservatism': 'Moderate Conservatism have been influenced by economic liberalism, generally supporting free markets, limited government spending and other policies heavily associated with neoliberalism. The moderate right is neither universally socially conservative nor culturally liberal, and often combines both beliefs with support for civil liberties and elements of traditionalism.',
  'Social Democracy': 'Social democracy is a political, social and economic philosophy within socialism. As a policy regime, it is described by academics as advocating economic and social interventions to promote social justice within the framework of a liberal-democratic polity and a capitalist-oriented mixed economy.',
  'Social Liberalism': 'Social Liberalism is a political philosophy and variety of liberalism that endorses a regulated market economy and the expansion of civil and political rights. Under social liberalism, the common good is viewed as harmonious with the freedom of the individual.',
};

function renderAbout() {
  const el = document.getElementById('about-benchmarks');
  if (!el) return;
  const presentIdeologies = [...new Set(D.map(e => e.political.ideology).filter(Boolean))].sort();
  let ideologiesHTML = '';
  for (const id of presentIdeologies) {
    const desc = IDEOLOGY_DESCRIPTIONS[id];
    if (!desc) continue;
    ideologiesHTML += `<p class="about-ideo"><strong>${id}:</strong> ${desc}</p>`;
  }
  if (!ideologiesHTML) ideologiesHTML = '<p class="about-p about-empty">No matching ideology descriptions for the currently loaded models.</p>';

  el.innerHTML = `
    <div class="about-inner">
      <h3 class="about-h">About the Benchmarks</h3>
      <p class="about-p">To ensure a fair evaluation, all test questions are kept private. This prevents models from being specifically trained on the benchmark itself.</p>
      <p class="about-section-title">UGI 🏆 — Uncensored General Intelligence</p>
      <p class="about-p">Measures a model's knowledge of sensitive topics and its ability to follow instructions when faced with controversial prompts.</p>
      <details open class="about-details"><summary class="about-summary">UGI is the combination of:</summary>
        <ul class="about-ul">
          <li><strong>Knowledge of sensitive information:</strong>
            <ul class="about-ul-sub">
              <li><strong>Hazardous:</strong> Knowledge of topics that LLMs probably shouldn't assist with.</li>
              <li><strong>Entertainment:</strong> Knowledge of adult or controversial entertainment and media.</li>
              <li><strong>SocPol:</strong> Knowledge of sensitive socio-political topics.</li>
            </ul>
          </li>
          <li><strong>W/10 👍 (Willingness/10):</strong> How far a model can be pushed before it refuses to answer or deviates from instructions.
            <ul class="about-ul-sub">
              <li><strong>W/10-Direct:</strong> Measures if the model directly refuses to respond to certain prompts.</li>
              <li><strong>W/10-Adherence:</strong> Measures if a model deviates from instructions, which can be a form of refusal or a lack of instruction following capabilities.</li>
            </ul>
          </li>
        </ul>
      </details>
      <p class="about-p about-note">A model with a high UGI, but low W/10 for example may be able to help provide you with an significant amount of accurate information on sensitive topics, but will see it as educational and will refuse to form the information into something against its values.</p>
      <p class="about-section-title">NatInt 💡 — Natural Intelligence</p>
      <p class="about-p">Measures a model's general knowledge and reasoning capabilities across a range of standard and specialized domains.</p>
      <details open class="about-details"><summary class="about-summary">NatInt is the combination of:</summary>
        <ul class="about-ul">
          <li><strong>Textbook:</strong> Measures knowledge of standard, factual information like history, statistics, math, and logic.</li>
          <li><strong>Pop Culture:</strong> Knowledge of specific details from things like video games, movies, music, and internet culture.</li>
          <li><strong>World Model:</strong> Tasks that test a model's understanding of real-world properties and patterns.
            <ul class="about-ul-sub">
              <li><strong>Cooking (% Error):</strong> Predicts needed ingredient amounts for recipes.</li>
              <li><strong>GeoGuesser (km Error):</strong> Identifies a location based on a description of its surroundings.</li>
              <li><strong>Weight (% Error):</strong> Estimates the weight of various objects based on their description.</li>
              <li><strong>Music (Error):</strong> Predicts a song's musical attributes (like bpm and loudness) based on its lyrics.</li>
              <li><strong>Show Recommendation Score:</strong> A model's ability to predict what rating out of ten a person will rate a TV show based on their previous ratings.
                <ul class="about-ul-sub">
                  <li><strong>Show Rec MAE:</strong> The mean absolute error between the model's predicted ratings and the user's true ratings.</li>
                  <li><strong>Show Rec Correlation:</strong> Measures how well the model's predictions trend with the user's true ratings.</li>
                  <li><strong>Show Rec Std Dev Error:</strong> The absolute difference between the spread of the model's predictions and the spread of the true ratings.</li>
                </ul>
              </li>
            </ul>
          </li>
        </ul>
      </details>
      <p class="about-section-title">Writing ✍️</p>
      <p class="about-p">A score of a model's writing ability, factoring in intelligence, writing style, amount of repetition, and adherence to requested output length. The score attempts to match the average person's preferences. Optimal values are displayed in parentheses in the column headers for the metrics used in the formula (e.g., 'Readability Grade (~5.5)'). These values were estimated using human feedback through model preference.</p>
      <p class="about-p">Models that are not able to consistently produce writing responses due to irreparable repetition issues, broken outputs, or constant refusals are not given a writing score.</p>
      <details open class="about-details"><summary class="about-summary">Writing Metrics</summary>
        <ul class="about-ul">
          <li><strong>NSFW/Dark Lean:</strong> Measures the tonal direction a model takes when doing creative writing, from SFW to explicit (NSFW) and from lighthearted to violent/tragic (Dark). <em>NOTE: A high or low number does not mean it is high or low quality. These two metrics solely measure frequency.</em></li>
          <li><strong>Stylistic Metrics:</strong>
            <ul class="about-ul-sub">
              <li><strong>Readability Grade:</strong> The estimated US school grade level needed to understand the text.</li>
              <li><strong>Verb/Noun Ratio:</strong> The ratio of action words (verbs) to naming words (nouns).</li>
              <li><strong>Adj&amp;Adv %:</strong> The percentage of descriptive words (adjectives and adverbs) out of total words.</li>
              <li><strong>Dialogue %:</strong> The percentage of sentences in the model's response that is dialogue when writing stories.</li>
            </ul>
          </li>
          <li><strong>Repetition Metrics:</strong>
            <ul class="about-ul-sub">
              <li><strong>Lexical Stuckness:</strong> Measures if the model gets 'stuck' using a limited vocabulary in parts of its writing.</li>
              <li><strong>Originality:</strong> Measures how unique a model's writing outputs are by comparing the word usage and themes used across different writing prompts.</li>
              <li><strong>Semantic Redundancy:</strong> Detects when the same concept is expressed multiple times with different wording.</li>
            </ul>
          </li>
          <li><strong>Length Adherence:</strong>
            <ul class="about-ul-sub">
              <li><strong>Length Error %:</strong> The average percentage difference between a user-requested word count and the generated word count.</li>
              <li><strong>Exceeded %:</strong> The percentage of times the model responds with more words than requested.</li>
            </ul>
          </li>
          <li><strong>Style Adherence:</strong> How closely the model is able to match the writing style of a given example.</li>
        </ul>
      </details>
      <p class="about-section-title">Political Lean 📋</p>
      <details open class="about-details"><summary class="about-summary">Political Metrics</summary>
        <ul class="about-ul">
          <li><strong>Political Lean 📋:</strong> Measures a model's political alignment based on its responses to the <a href="https://politicaltests.github.io/12axes/" target="_blank" class="about-link">12axes</a> test. The Political Lean metric uses a simplified version with the Assimilationist-Multiculturalist, Average(Collectivize-Privatize &amp; Planned-LaissezFaire), and Progressive-Traditional axes. The score ranges from -100% (Left) to 100% (Right).</li>
          <li><strong>12axes Ideology:</strong> The closest matching political ideology from the 12axes test.</li>
          <li><strong>Aggregate Scores:</strong>
            <ul class="about-ul-sub">
              <li><strong>Govt:</strong> Higher = State authority, Lower = Individual liberty</li>
              <li><strong>Dipl:</strong> Higher = Global outlook, Lower = National interests</li>
              <li><strong>Econ:</strong> Higher = Economic equality, Lower = Market freedom</li>
              <li><strong>Scty:</strong> Higher = Progressive values, Lower = Traditional values</li>
            </ul>
          </li>
        </ul>
      </details>
      <details class="about-details"><summary class="about-summary">12axes Ideology Descriptions <span class="about-ideo-count">(${presentIdeologies.filter(i => IDEOLOGY_DESCRIPTIONS[i]).length} shown)</span></summary>
        <div class="about-ideo-list">
          <p class="about-p about-empty-note"><em>Only showing ideologies that at least one loaded model has.</em></p>
          ${ideologiesHTML}
          <p class="about-source"><a href="https://github.com/politicaltests/politicaltests.github.io/blob/main/12axes/ideologies.js" target="_blank" class="about-link">Source ↗</a></p>
        </div>
      </details>
    </div>`;
}

/* ── Map view: PCA on atomic features ── */

const MAP_FEATURES = [
  {l:'Hazardous',     get:e=>e.ugi_breakdown.hazardous},
  {l:'Entertainment', get:e=>e.ugi_breakdown.entertainment},
  {l:'SocPol',        get:e=>e.ugi_breakdown.socpol},
  {l:'NSFW',          get:e=>e.ugi_breakdown.nsfw_score},
  {l:'Dark',          get:e=>e.ugi_breakdown.dark_score},
  {l:'W/10-Direct',   get:e=>e.scores.w10.direct},
  {l:'W/10-Adherence',get:e=>e.scores.w10.adherence},
  {l:'Textbook',      get:e=>e.natint_breakdown.textbook},
  {l:'Pop Culture',   get:e=>e.natint_breakdown.pop_culture},
  {l:'Recipe Err',    get:e=>e.natint_breakdown.recipe_err},
  {l:'Geo MAE',       get:e=>e.natint_breakdown.geo_mae},
  {l:'Weight Err',    get:e=>e.natint_breakdown.weight_err},
  {l:'Music MAE',     get:e=>e.natint_breakdown.music_mae},
  {l:'Show MAE',      get:e=>e.show_rec.mae},
  {l:'Show Corr',     get:e=>e.show_rec.correlation},
  {l:'Show Std',      get:e=>e.show_rec.std_dev},
  {l:'Style',         get:e=>e.writing.style_score},
  {l:'Originality',   get:e=>e.writing.originality},
  {l:'Readability',   get:e=>e.writing.readability_grade},
  {l:'Dialogue %',    get:e=>e.writing.dialogue_pct},
  {l:'Verb/Noun',     get:e=>e.writing.verb_noun_ratio},
  {l:'Adj/Adv %',     get:e=>e.writing.adj_adv_pct},
  {l:'Length Err',    get:e=>e.writing.length_error_pct},
  {l:'WC Exceeded',   get:e=>e.writing.wc_exceeded_pct},
  {l:'Sem Redund',    get:e=>e.writing.semantic_redundancy},
  {l:'Lex Stuck',     get:e=>e.writing.lexical_stuckness},
  {l:'Fed-Unit',      get:e=>e.political.axes_12.fed_unit},
  {l:'Dem-Auto',      get:e=>e.political.axes_12.dem_auto},
  {l:'Sec-Free',      get:e=>e.political.axes_12.sec_free},
  {l:'Nat-Int',       get:e=>e.political.axes_12.nat_int},
  {l:'Mil-Pac',       get:e=>e.political.axes_12.mil_pac},
  {l:'Assim-Mult',    get:e=>e.political.axes_12.assim_mult},
  {l:'Coll-Priv',     get:e=>e.political.axes_12.coll_priv},
  {l:'Plan-Lais',     get:e=>e.political.axes_12.plan_lais},
  {l:'Iso-Glob',      get:e=>e.political.axes_12.iso_glob},
  {l:'Irrel-Rel',     get:e=>e.political.axes_12.irrel_rel},
  {l:'Prog-Trad',     get:e=>e.political.axes_12.prog_trad},
  {l:'Accel-Bio',     get:e=>e.political.axes_12.accel_bio},
];

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

function _jacobi(A, maxIter = 200, eps = 1e-12) {
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

function computeMapPCA() {
  const n = D.length, m = MAP_FEATURES.length;
  const colVals = Array.from({length:m}, () => []);
  const M = D.map(e => MAP_FEATURES.map((f, j) => {
    const v = f.get(e);
    if (typeof v === 'number' && !isNaN(v)) colVals[j].push(v);
    return v;
  }));
  const colMeans = colVals.map(vs => vs.length ? vs.reduce((a,b) => a+b, 0) / vs.length : 0);
  for (let i = 0; i < n; i++) for (let j = 0; j < m; j++)
    if (typeof M[i][j] !== 'number' || isNaN(M[i][j])) M[i][j] = colMeans[j];
  const stds = _colStds(M, colMeans);
  const Z = M.map(row => row.map((v, j) => (v - colMeans[j]) / stds[j]));
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
  return full.includes('/') ? full.substring(full.indexOf('/') + 1) : full;
}

function renderMap() {
  const el = document.getElementById('v-map');
  if (!el) return;
  el.style.padding = '0';
  _mapSearch = document.getElementById('search').value;

  /* Destroy any stale chart from a previous render (e.g. after visiting Chart view) */
  if (_mapChart) { _mapChart.destroy(); _mapChart = null; }

  const typeColors = { Thinking:'#e05c5c', Finetuned:'#a88fe0', Merged:'#5db87a', Foundation:'#5ca8d8', Other:'#686862' };
  const typeOrder = ['Thinking','Finetuned','Merged','Foundation','Other'];

  const DATE_EPOCH = new Date('2020-01-01').getTime();
  const dateToNum = s => { if (!s) return NaN; const d = new Date(s); return isNaN(d) ? NaN : (d.getTime() - DATE_EPOCH) / 86400000; };
  const numToDateLbl = n => { const d = new Date(DATE_EPOCH + n * 86400000); return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0'); };
  const MAP_DATE_KEYS = new Set(['released','tested']);

  const EG = Object.assign({}, G, {
    released: e => dateToNum(e.model.released),
    tested:   e => dateToNum(e.model.tested),
  });

  const numCols = CL.filter(c => G[c.id] && c.cls?.includes('nm') && c.t !== 'date');
  const dateCols = [{ id:'released', l:'RELEASED', g:'Info' }, { id:'tested', l:'TESTED', g:'Info' }];
  const allAxisCols = [...numCols, ...dateCols];
  const axisGroups = {};
  for (const c of allAxisCols) { const g = c.g || 'Other'; (axisGroups[g] = axisGroups[g] || []).push(c); }
  const optHTML = sel => Object.entries(axisGroups).map(([g, cols]) =>
    `<optgroup label="${g}">${cols.map(c => `<option value="${c.id}"${c.id === sel ? ' selected' : ''}>${c.l}</option>`).join('')}</optgroup>`
  ).join('');

  const pca = computeMapPCA();
  const pcCount = Math.min(6, pca.order.length);
  const pcOptHTML = sel => { let h = ''; for (let i = 0; i < pcCount; i++) { const v = (pca.eigenvalues[pca.order[i]] / pca.totalVar * 100).toFixed(1); h += `<option value="${i+1}"${i+1 === sel ? ' selected' : ''}>PC${i+1} (${v}%)</option>`; } return h; };

  let xPC = 1, yPC = 2, zKey = 'ugi', colorMode = 'type', showLabels = true;

  const SS = 'background:var(--bg3);border:1px solid var(--bd);color:var(--t);font:11px IBM Plex Mono,monospace;padding:2px 4px;outline:none';
  const btnS = on => `background:${on?'var(--ac)':'var(--bg3)'};border:1px solid ${on?'var(--ac)':'var(--bd)'};color:${on?'var(--bg)':'var(--t2)'};font:${on?600:500} 10px IBM Plex Mono,monospace;padding:2px 8px;cursor:pointer;transition:all .1s`;

  el.innerHTML =
    `<div class="map-toolbar">` +
      `<span class="map-title">Similarity Map</span>` +
      `<span class="map-subtitle">${MAP_FEATURES.length} atomic · ${D.length} models · PCA</span>` +
      `<div style="width:1px;height:14px;background:var(--bd);flex-shrink:0"></div>` +
      `<label style="display:flex;align-items:center;gap:5px;font-size:11px;color:var(--t2)">X <select id="pc-x" style="${SS}">${pcOptHTML(1)}</select></label>` +
      `<label style="display:flex;align-items:center;gap:5px;font-size:11px;color:var(--t2)">Y <select id="pc-y" style="${SS}">${pcOptHTML(2)}</select></label>` +
      `<div style="width:1px;height:14px;background:var(--bd);flex-shrink:0"></div>` +
      `<span style="font-size:9px;color:var(--t3);letter-spacing:.08em;text-transform:uppercase">Color</span>` +
      `<button id="cm-type" style="${btnS(true)}">Type</button>` +
      `<button id="cm-col" style="${btnS(false)}">Column</button>` +
      `<label id="z-wrap" style="display:none;align-items:center;gap:5px;font-size:11px;color:var(--t2)">Z <select id="sc-z" style="${SS}">${optHTML('ugi')}</select></label>` +
      `<div style="width:1px;height:14px;background:var(--bd);flex-shrink:0"></div>` +
      `<button id="map-labels" style="${btnS(true)}">Labels</button>` +
      `<button id="map-reset" class="map-reset">Reset view</button>` +
      `<span class="map-hint">scroll = zoom · drag = pan · click = details</span>` +
    `</div>` +
    `<div class="map-canvas-wrap"><canvas id="map-cv"></canvas><div class="map-loadings" id="map-loadings"></div></div>` +
    `<div id="z-legend" style="display:none;padding:4px 12px;border-top:1px solid var(--bd);background:var(--bg2);flex-shrink:0;align-items:center;gap:8px;font-size:10px;color:var(--t2)"></div>`;

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

  function updateColorUI() {
    const isCol = colorMode === 'column';
    document.getElementById('cm-type').setAttribute('style', btnS(!isCol));
    document.getElementById('cm-col').setAttribute('style', btnS(isCol));
    document.getElementById('z-wrap').style.display = isCol ? 'flex' : 'none';
    document.getElementById('z-legend').style.display = isCol ? 'flex' : 'none';
  }

  const viridisGradCSS = () => 'linear-gradient(to right,' + [0,0.25,0.5,0.75,1].map(t => `${viridis(t)} ${t*100}%`).join(',') + ')';
  const fmtV = (key, v) => MAP_DATE_KEYS.has(key) ? numToDateLbl(v) : fN(v);

  function buildDatasets() {
    const vx = getPCVec(xPC), vy = getPCVec(yPC);
    const proj = pca.Z.map((row, i) => ({ x: _dot(row, vx), y: _dot(row, vy), e: D[i] }));
    let datasets;
    if (colorMode === 'type') {
      const byType = {};
      for (const p of proj) { const t = modelType(p.e.model.flags); (byType[t] = byType[t] || []).push(p); }
      datasets = typeOrder.filter(t => byType[t]).map(t => ({
        label: t, data: byType[t], backgroundColor: typeColors[t] + 'b3',
        pointRadius: 2.5, pointHoverRadius: 6, pointBorderWidth: 0,
      }));
    } else {
      const pts = proj.map(p => {
        const z = EG[zKey]?.(p.e);
        return { x: p.x, y: p.y, z: (typeof z === 'number' && !isNaN(z)) ? z : null, e: p.e };
      });
      const zVals = pts.map(p => p.z).filter(v => v !== null);
      const zMin = zVals.length ? Math.min(...zVals) : 0;
      const zMax = zVals.length ? Math.max(...zVals) : 1;
      const zRng = zMax - zMin || 1;
      datasets = [{
        label: allAxisCols.find(c => c.id === zKey)?.l || zKey,
        data: pts,
        backgroundColor: pts.map(p => p.z !== null ? viridis((p.z - zMin) / zRng) : 'rgba(80,80,80,0.35)'),
        pointRadius: 2.5, pointHoverRadius: 6, pointBorderWidth: 0,
      }];
      const zLabel = allAxisCols.find(c => c.id === zKey)?.l || zKey;
      const legendEl = document.getElementById('z-legend');
      if (legendEl) legendEl.innerHTML =
        `<span style="font-size:9px;color:var(--t3);letter-spacing:.08em;text-transform:uppercase">${zLabel}</span>` +
        `<span>${fmtV(zKey, zMin)}</span>` +
        `<div style="flex:1;max-width:180px;height:8px;background:${viridisGradCSS()};border:1px solid var(--bd);border-radius:1px"></div>` +
        `<span>${fmtV(zKey, zMax)}</span>`;
    }
    if (_mapSearch) {
      const lq = _mapSearch.toLowerCase();
      for (const ds of datasets) {
        ds.pointRadius = ds.data.map(p => (p.e.model.name || '').toLowerCase().includes(lq) ? 7 : 1.5);
        ds.pointHoverRadius = ds.data.map(p => (p.e.model.name || '').toLowerCase().includes(lq) ? 9 : 3);
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
          const ugi = raw.e?.scores?.ugi;
          const isMatch = _mapSearch && fullName.toLowerCase().includes(_mapSearch.toLowerCase());
          items.push({
            x: pt.x, y: pt.y,
            name: mapShortName(fullName),
            ugi: typeof ugi === 'number' && !isNaN(ugi) ? ugi : -Infinity,
            isMatch,
            visible: pt.x >= -50 && pt.x <= chart.width + 50 && pt.y >= -50 && pt.y <= chart.height + 50,
          });
        }
      }
      items.sort((a, b) => { if (a.isMatch !== b.isMatch) return a.isMatch ? -1 : 1; return b.ugi - a.ugi; });
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
        ctx.fillStyle = it.isMatch ? 'rgba(232,197,71,0.95)' : 'rgba(19,19,21,0.82)';
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
            legend: colorMode === 'type'
              ? { labels: { color: '#686862', font: { family: 'IBM Plex Mono', size: 9 }, boxWidth: 8, padding: 12 } }
              : { display: false },
            tooltip: {
              mode: 'nearest', intersect: true,
              callbacks: {
                title: ctx => ctx[0].raw.e.model.name,
                label: ctx => {
                  if (colorMode !== 'column' || ctx.raw.z === null) return '';
                  return `${allAxisCols.find(c => c.id === zKey)?.l || zKey}: ${fmtV(zKey, ctx.raw.z)}`;
                },
              },
              backgroundColor: '#131315', borderColor: '#303035', borderWidth: 1,
              titleColor: '#ccccc4', bodyColor: '#686862', displayColors: false,
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
            x: { title: { display: true, text: `PC${xPC} (${(xVar*100).toFixed(1)}%)`, color: '#686862', font: { family: 'IBM Plex Mono', size: 9 } }, grid: { color: '#252528' }, ticks: { color: '#686862', font: { family: 'IBM Plex Mono', size: 9 } } },
            y: { title: { display: true, text: `PC${yPC} (${(yVar*100).toFixed(1)}%)`, color: '#686862', font: { family: 'IBM Plex Mono', size: 9 } }, grid: { color: '#252528' }, ticks: { color: '#686862', font: { family: 'IBM Plex Mono', size: 9 } } },
          },
        },
      });
    }
  }

  _mapDraw = draw;
  document.getElementById('pc-x').onchange = function() { xPC = parseInt(this.value); updateLoadings(); draw(); };
  document.getElementById('pc-y').onchange = function() { yPC = parseInt(this.value); updateLoadings(); draw(); };
  document.getElementById('cm-type').onclick = () => { colorMode = 'type';   updateColorUI(); draw(); };
  document.getElementById('cm-col').onclick  = () => { colorMode = 'column'; updateColorUI(); draw(); };
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
