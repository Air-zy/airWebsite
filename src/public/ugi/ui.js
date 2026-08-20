/* ui.js — event listeners, view switching, command palette */

let _infoChart = null;
let _infoDraw  = null;   /* exposed by renderInfo so the search handler can call it */

function switchV(v) {
  vw = v;
  closeDet();
  document.querySelectorAll('.bt[data-v]').forEach(b => b.classList.toggle('on', b.dataset.v === v));
  document.getElementById('v-lb').classList.toggle('hid',  v !== 'lb');
  document.getElementById('v-info').classList.toggle('hid',v !== 'info');
  document.getElementById('v-map').classList.toggle('hid', v !== 'map');
  document.getElementById('v-rec').classList.toggle('hid', v !== 'rec');
  document.getElementById('sidebar').classList.toggle('hid', v !== 'lb');
  document.getElementById('sbt').classList.toggle('hid', v !== 'lb');
  document.getElementById('search').placeholder =
    v === 'map' ? 'Highlight…' :
    v === 'rec' ? 'Find model…' :
    v === 'info' ? 'Search…' : 'Filter…';
  closeThPop();
  if (v === 'lb')   renderLB();
  if (v === 'info') renderInfo();
  if (v === 'map')  renderMap();
  if (v === 'rec')  renderRec();
}

let cpSel = 0;

function renderCmd(c, idx, sel) {
  const on = vC.has(c.id) ? ' <span style="color:var(--ac)">✓</span>' : '';
  return `<div class="ci${idx === sel ? ' sel' : ''}" data-c="${c.id}" data-idx="${idx}">
    <span>${c.l}${on}</span><small>${c.g || 'General'}</small>
  </div>`;
}

function renderCmdList(q) {
  const pool = CL.filter(c => !c.a);
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
  if (vC.has(c.id)) vC.delete(c.id); else vC.add(c.id);
  renderColBar();
  renderLB();
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
  let xKey = 'natint', yKey = 'dialogue', zKey = 'score', colorMode = 'type';

  el.innerHTML =
    `<div class="ctrl-bar">` +
      `<label class="ctrl">X <select id="sc-x" style="${SS}">${axisOptHTML(xKey)}</select></label>` +
      `<label class="ctrl">Y <select id="sc-y" style="${SS}">${axisOptHTML(yKey)}</select></label>` +
      `<span class="cap">Color</span>` +
      `<button id="cm-type" style="${btnS(true)}">Type</button>` +
      `<button id="cm-col" style="${btnS(false)}">Column</button>` +
      `<label id="z-wrap" class="ctrl" style="display:none">Z <select id="sc-z" style="${SS}">${axisOptHTML(zKey)}</select></label>` +
      `<span class="ctrl-r" id="sc-count"></span>` +
    `</div>` +
    `<div class="map-canvas-wrap"><canvas id="sc-cv"></canvas></div>` +
    `<div id="z-legend" class="z-legend"></div>`;

  function draw() {
    if (_infoChart) { _infoChart.destroy(); _infoChart = null; }
    const pts = [];
    for (const e of filt()) {
      const x = EG[xKey]?.(e), y = EG[yKey]?.(e);
      if (typeof x === 'number' && !isNaN(x) && typeof y === 'number' && !isNaN(y)) pts.push({ x, y, e });
    }
    const datasets = colorMode === 'type' ? typeDatasets(pts, 4) : [colorDataset(pts, zKey, 4)];
    document.getElementById('sc-count').textContent = `${pts.length} / ${D.length}`;

    /* Date columns hold days-since-2020, so their ticks need relabelling */
    const axis = k => DATE_KEYS.has(k)
      ? { ...CH_AXIS, ticks: { ...CH_AXIS.ticks, callback: v => numToDateLbl(v) } }
      : CH_AXIS;

    _infoChart = new Chart(document.getElementById('sc-cv'), {
      type: 'scatter',
      data: { datasets },
      options: {
        animation: false,
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: colorMode === 'type' ? CH_LEGEND : { display: false },
          tooltip: {
            ...CH_TIP,
            callbacks: {
              title: ctx => ctx[0].raw.e.model.name,
              label: ctx => (colorMode !== 'column' || ctx.raw.z === null) ? ''
                : `${axisLabel(zKey)}: ${fmtAxisV(zKey, ctx.raw.z)}`,
            },
          },
        },
        onClick: (_, els) => {
          if (els.length) openDet(datasets[els[0].datasetIndex].data[els[0].index].e);
        },
        scales: { x: axis(xKey), y: axis(yKey) },
      },
    });
  }

  _infoDraw = draw;   /* let the search handler trigger redraws */
  document.getElementById('cm-type').onclick = () => { colorMode = 'type';   updateColorUI(false); draw(); };
  document.getElementById('cm-col' ).onclick = () => { colorMode = 'column'; updateColorUI(true);  draw(); };
  document.getElementById('sc-x').onchange = function() { xKey = this.value; draw(); };
  document.getElementById('sc-y').onchange = function() { yKey = this.value; draw(); };
  document.getElementById('sc-z').onchange = function() { zKey = this.value; draw(); };
  draw();
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
  renderAbout();

  /* Sidebar toggle — collapsed by default where it would crowd the table */
  if (innerWidth < 900) document.body.classList.add('sb-off');
  document.getElementById('sbt').onclick = () => document.body.classList.toggle('sb-off');

  /* View buttons */
  document.querySelectorAll('.bt[data-v]').forEach(b => {
    b.onclick = () => switchV(b.dataset.v);
  });

  /* Search — feeds the active view (LB filter / chart filter / map highlight / rec filter) */
  const searchEl = document.getElementById('search');
  searchEl.oninput = function() {
    sq = this.value.toLowerCase().trim();
    if (vw === 'lb') renderLB();
    else if (vw === 'info') _infoDraw?.();
    else if (vw === 'map') { _mapSearch = this.value; _mapDraw?.(); }
    else if (vw === 'rec') { renderRecRate(); recUpdate(); }
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

  document.addEventListener('click', e => {
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
    FF = { finetuned: null, merged: null, foundation: null, thinking: null, open: null };
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
      if (e.key === '2') switchV('info');
      if (e.key === '3') switchV('map');
      if (e.key === '4') switchV('rec');
    }
  });
}

document.addEventListener('DOMContentLoaded', init);
