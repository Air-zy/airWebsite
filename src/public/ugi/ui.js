/* ui.js — event listeners, view switching, command palette */

function switchV(v) {
  vw = v;
  closeDet();
  document.querySelectorAll('.bt[data-v]').forEach(b => b.classList.toggle('on', b.dataset.v === v));
  document.getElementById('v-lb').classList.toggle('hid',  v !== 'lb');
  document.getElementById('v-agg').classList.toggle('hid', v !== 'agg');
  document.getElementById('v-info').classList.toggle('hid',v !== 'info');
  document.getElementById('cwrap').classList.toggle('hid', v !== 'agg');
  document.getElementById('sidebar').classList.toggle('hid', v !== 'lb');
  closeThPop();
  if (v === 'lb')   renderLB();
  if (v === 'agg')  { renderCP(); renderAgg(); }
  if (v === 'info') renderInfo();
}

let cpSel = 0;

function renderCmd(c, idx, sel) {
  const vs  = vw === 'agg' ? aVC : vC;
  const key = c.k || c.id;
  const on  = vs.has(key) ? '✓' : '';
  const cls = 'ci' + (idx === sel ? ' sel' : '');
  return `<div class="${cls}" data-c="${key}" data-idx="${idx}">
    <span>${c.l}${on ? ' <span style="color:var(--ac)">✓</span>' : ''}</span>
    <small>${c.g || 'General'}</small>
  </div>`;
}

function renderCmdList(q) {
  const isA  = vw === 'agg';
  const pool = isA ? AF : CL.filter(c => !c.a);
  const lq   = (q || '').toLowerCase();
  const hits  = lq ? pool.filter(c => c.l.toLowerCase().includes(lq) || (c.g || '').toLowerCase().includes(lq)) : pool;
  cpSel = 0;
  document.getElementById('cmdp-ls').innerHTML =
    hits.length ? hits.map((c, i) => renderCmd(c, i, cpSel)).join('') : '<div class="ci" style="color:var(--t3)">No matches</div>';
  bindCmdItems(hits);
}

function bindCmdItems(hits) {
  document.querySelectorAll('#cmdp-ls .ci[data-c]').forEach((el, i) => {
    el.onmouseenter = () => { cpSel = i; highlightCmd(); };
    el.onclick = () => toggleCmdCol(hits[i]);
  });
}

function highlightCmd() {
  document.querySelectorAll('#cmdp-ls .ci').forEach((el, i) => el.classList.toggle('sel', i === cpSel));
}

function toggleCmdCol(c) {
  if (!c) return;
  const vs  = vw === 'agg' ? aVC : vC;
  const key = c.k || c.id;
  if (vs.has(key)) vs.delete(key); else vs.add(key);
  if (vw === 'lb') renderColBar();
  if (vw === 'agg') renderCP();
  if (vw === 'agg') renderAgg(); else renderLB();
  renderCmdList(document.getElementById('cmdp-in').value);
}

function openCmdP() {
  document.getElementById('cmdp').classList.add('open');
  document.getElementById('cmdp-in').value = '';
  renderCmdList('');
  setTimeout(() => document.getElementById('cmdp-in').focus(), 0);
}

function closeCmdP() {
  document.getElementById('cmdp').classList.remove('open');
}

function renderInfo() {
  const el = document.getElementById('v-info');

  /* Dataset stats */
  const total  = D.length;
  const counts = { thinking:0, finetuned:0, merged:0, foundation:0, other:0 };
  for (const e of D) {
    const f = e.model.flags;
    if      (f.thinking)   counts.thinking++;
    else if (f.finetuned)  counts.finetuned++;
    else if (f.merged)     counts.merged++;
    else if (f.foundation) counts.foundation++;
    else                   counts.other++;
  }

  const paramBuckets = ['< 1B','1–4B','4–8B','8–15B','15–35B','35–75B','75–200B','200B+'];
  const bkts = {};
  paramBuckets.forEach(b => bkts[b] = 0);
  for (const e of D) { const b = buckParam(e.model.params.active); if (bkts[b] !== undefined) bkts[b]++; }

  /* Viridis scale bar (SVG) */
  const stops = [
    [0.00,'#440154'],[0.13,'#48287a'],[0.25,'#3e4989'],
    [0.38,'#31688e'],[0.50,'#26828e'],[0.63,'#35b779'],
    [0.75,'#6ece58'],[0.88,'#b5de2b'],[1.00,'#fde725'],
  ];
  const gradId = 'vg';
  const svgStops = stops.map(([o,c]) => `<stop offset="${o*100}%" stop-color="${c}"/>`).join('');
  const viridisBar = `<svg width="100%" height="14" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="${gradId}"><linearGradient id="${gradId}">${svgStops}</linearGradient></defs>
    <rect width="100%" height="100%" fill="url(#${gradId})"/>
  </svg>`;

  const viridisBarFixed = `<svg width="100%" height="14" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="${gradId}" x1="0" x2="1" y1="0" y2="0">${svgStops}</linearGradient></defs>
    <rect width="100%" height="100%" fill="url(#${gradId})"/>
  </svg>`;

  const metrics = [
    { g:'Main Scores', rows:[
      ['UGI 🏆',      'Composite uncensored general intelligence score. Primary ranking metric.'],
      ['Writing ✍️',  'Aggregate writing quality — style, originality, coherence, and instruction adherence.'],
      ['NatInt 💡',   'Natural intelligence — practical world knowledge across textbook, culture, geography, recipes, and music.'],
      ['W/10 👍',     'Direct preference score from human evaluators. Split into Direct (raw) and Adherence (instruction-following).'],
    ]},
    { g:'UGI Breakdown', rows:[
      ['Sensitive Info', 'Willingness to discuss sensitive or restricted topics factually.'],
      ['Hazardous',      'Handling of hazardous content queries without unnecessary refusals.'],
      ['Entertainment',  'Engaging, enjoyable responses for casual or entertainment prompts.'],
      ['SocPol',         'Handling of social and political topics without evasion or deflection.'],
      ['NSFW',           'Average NSFW content score where appropriate.'],
      ['Dark',           'Willingness to engage with dark themes and fiction without moralizing.'],
    ]},
    { g:'NatInt Breakdown', rows:[
      ['Textbook',   'Accuracy on academic / textbook-style knowledge questions.'],
      ['Pop Culture','Knowledge of movies, TV, music, and internet culture.'],
      ['World Model','Practical world knowledge: geography, weights, recipes.'],
      ['Recipe Err', '↓ Average % error on recipe quantity/proportion questions. Lower = better.'],
      ['Geo MAE',    '↓ Mean absolute error on geolocation estimation tasks. Lower = better.'],
      ['Weight Err', '↓ Mean % error on object weight estimation. Lower = better.'],
      ['Music MAE',  '↓ Mean absolute error on music/frequency tasks. Lower = better.'],
    ]},
    { g:'Writing Breakdown', rows:[
      ['Style',        'Overall writing style quality score assessed by judge.'],
      ['Originality',  'How non-generic and inventive the writing is (0–1 scale).'],
      ['Readability',  'Flesch-Kincaid grade level of output prose.'],
      ['Dialogue %',   'Proportion of output that is dialogue — higher can indicate over-reliance on dialogue.'],
      ['Sem Redund',   '↓ Internal semantic redundancy — repeating the same ideas. Lower = better.'],
      ['Lex Stuck',    '↓ Lexical stuckness — overusing the same words. Lower = better.'],
      ['Length Err',   '↓ Average % deviation from requested word count. Lower = better.'],
      ['WC Exceeded',  '↓ % of responses that exceeded the word count limit. Lower = better.'],
    ]},
    { g:'Show Recommendation', rows:[
      ['Score',       'Accuracy of TV/film recommendations aligned with user taste profiles.'],
      ['MAE',         '↓ Mean absolute error of recommendation scores. Lower = better.'],
      ['Std Dev',     '↓ Standard deviation of recommendation errors. Lower = better.'],
      ['Correlation', 'Pearson correlation between model recommendations and human ratings.'],
    ]},
  ];

  const statBadge = (label, val, tag='') =>
    `<div class="inf-stat"><span class="inf-stat-v${tag ? ' '+tag : ''}">${val}</span><span class="inf-stat-l">${label}</span></div>`;

  const bktBars = paramBuckets.map(b => {
    const n = bkts[b] || 0;
    const pct = total ? (n/total*100).toFixed(0) : 0;
    return `<div class="inf-bkt"><span class="inf-bkt-l">${b}</span><div class="inf-bkt-bar"><div class="inf-bkt-fill" style="width:${pct}%"></div></div><span class="inf-bkt-n">${n}</span></div>`;
  }).join('');

  el.innerHTML = `
    <div class="inf">
      <section class="inf-sec">
        <h2 class="inf-h">UGI Leaderboard</h2>
        <p class="inf-p">Ranks language models on uncensored general intelligence — capabilities that safety-filtered benchmarks typically avoid. Models are evaluated across writing quality, practical world knowledge, user preference, and content flexibility.</p>
      </section>

      <section class="inf-sec">
        <h3 class="inf-sh">Dataset — ${total} models</h3>
        <div class="inf-stats">
          ${statBadge('Total', total)}
          ${statBadge('Thinking', counts.thinking, 'tag-th')}
          ${statBadge('Finetuned', counts.finetuned, 'tag-ft')}
          ${statBadge('Merged', counts.merged, 'tag-mg')}
          ${statBadge('Foundation', counts.foundation, 'tag-fn')}
          ${statBadge('Other', counts.other)}
        </div>
        <div class="inf-bkts">${bktBars}</div>
      </section>

      <section class="inf-sec">
        <h3 class="inf-sh">Detail panel color scale</h3>
        <p class="inf-p">Value colors in the model detail panel show percentile rank within the comparison group using the Viridis scale.</p>
        <div class="inf-vbar">${viridisBarFixed}</div>
        <div class="inf-vlbl"><span>0th percentile</span><span>50th</span><span>100th</span></div>
        <p class="inf-p" style="margin-top:6px">For error metrics (MAE, Err, Redund, Stuck…) the scale is inverted — bright = low error.</p>
      </section>

      ${metrics.map(({ g, rows }) => `
      <section class="inf-sec">
        <h3 class="inf-sh">${g}</h3>
        <table class="inf-tbl">
          ${rows.map(([k, d]) => `<tr><td class="inf-tk">${k}</td><td class="inf-td">${d}</td></tr>`).join('')}
        </table>
      </section>`).join('')}
    </div>`;
}

async function init() {
  document.getElementById('status').textContent = 'Loading…';
  try {
    const res  = await fetch(CSV);
    const text = await res.text();
    D = pCSV(text).map(fmtE).filter(e => e.model.name);
    buildPctData();
  } catch (err) {
    document.getElementById('status').textContent = 'Error loading data';
    console.error(err);
    return;
  }

  renderLB();
  renderColBar();

  /* Hide cols button initially (lb view) */
  document.getElementById('cwrap').classList.add('hid');

  /* View buttons */
  document.querySelectorAll('.bt[data-v]').forEach(b => {
    b.onclick = () => switchV(b.dataset.v);
  });

  /* Search */
  document.getElementById('search').oninput = function() {
    sq = this.value.toLowerCase().trim();
    if (vw === 'lb') renderLB(); else if (vw === 'agg') renderAgg();
  };

  /* Column header: sort on label click, popover on ▾ icon */
  document.getElementById('lth').addEventListener('click', e => {
    const ic = e.target.closest('.th-ic[data-pop]');
    if (ic) { e.stopPropagation(); openThPop(ic.dataset.pop, ic); return; }
    const lbl = e.target.closest('.th-lbl[data-c]');
    if (!lbl) return;
    const c = lbl.dataset.c;
    if (sC === c) sD = -sD; else { sC = c; sD = -1; }
    closeThPop();
    renderLB();
  });

  /* Cols dropdown (agg only) */
  const cbt   = document.getElementById('cbt');
  const cpick = document.getElementById('cpick');
  cbt.onclick = e => {
    e.stopPropagation();
    const hidden = cpick.classList.toggle('hid');
    if (!hidden) renderCP();
    closeThPop();
  };
  document.addEventListener('click', e => {
    if (!cpick.contains(e.target) && e.target !== cbt) cpick.classList.add('hid');
    const pop = document.getElementById('thpop');
    if (!pop.classList.contains('hide') &&
        !pop.contains(e.target) &&
        !e.target.closest('.th-ic')) {
      closeThPop();
    }
  });

  /* Reset via sidebar */
  document.getElementById('sidebar').addEventListener('click', e => {
    if (e.target.id !== 'cb-reset') return;
    W  = {};
    FF = { finetuned: null, merged: null, foundation: null, thinking: null };
    sq = ''; rowLimit = 20;
    sC = 'score'; sD = -1; exR = null;
    vC = new Set(['rank','name','score','ugi','writing','natint','w10','params']);
    document.getElementById('search').value = '';
    closeThPop();
    renderColBar();
    renderLB();
  });

  /* Command palette */
  document.getElementById('cmdp').onclick = e => {
    if (e.target === document.getElementById('cmdp')) closeCmdP();
  };
  document.getElementById('cmdp-in').oninput = function() { renderCmdList(this.value); };
  document.getElementById('cmdp-in').onkeydown = e => {
    const items = document.querySelectorAll('#cmdp-ls .ci[data-c]');
    if (!items.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); cpSel = Math.min(cpSel + 1, items.length - 1); highlightCmd(); items[cpSel]?.scrollIntoView({ block: 'nearest' }); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); cpSel = Math.max(cpSel - 1, 0); highlightCmd(); items[cpSel]?.scrollIntoView({ block: 'nearest' }); }
    else if (e.key === 'Enter') { e.preventDefault(); items[cpSel]?.click(); }
    else if (e.key === 'Escape') closeCmdP();
  };

  /* Global shortcuts */
  document.addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      document.getElementById('cmdp').classList.contains('open') ? closeCmdP() : openCmdP();
    }
    if (e.key === 'Escape') {
      if (document.getElementById('cmdp').classList.contains('open')) closeCmdP();
      else closeThPop();
    }
    if (document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'SELECT') {
      if (e.key === '1') switchV('lb');
      if (e.key === '2') switchV('agg');
      if (e.key === '3') switchV('info');
    }
  });
}

document.addEventListener('DOMContentLoaded', init);