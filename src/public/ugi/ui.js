/* ui.js — event listeners, view switching, command palette */

let _infoChart = null;

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
  el.style.padding = '0';

  /* ── Type color palette ── */
  const typeColors = { Thinking:'#e05c5c', Finetuned:'#a88fe0', Merged:'#5db87a', Foundation:'#5ca8d8', Other:'#686862' };
  const typeOrder  = ['Thinking','Finetuned','Merged','Foundation','Other'];

  /* ── Date helpers ── */
  const DATE_EPOCH   = new Date('2020-01-01').getTime();
  const dateToNum    = s => { if (!s) return NaN; const d = new Date(s); return isNaN(d) ? NaN : (d.getTime() - DATE_EPOCH) / 86400000; };
  const numToDateLbl = n => { const d = new Date(DATE_EPOCH + n * 86400000); return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0'); };
  const DATE_KEYS    = new Set(['released','tested']);

  /* ── Extended getters (adds numeric date cols) ── */
  const EG = Object.assign({}, G, {
    released: e => dateToNum(e.model.released),
    tested:   e => dateToNum(e.model.tested),
  });

  /* ── Axis column list: numeric + date ── */
  const numCols    = CL.filter(c => G[c.id] && c.cls?.includes('nm'));
  const dateCols   = [{ id:'released', l:'RELEASED', g:'Info' }, { id:'tested', l:'TESTED', g:'Info' }];
  const allAxisCols = [...numCols, ...dateCols];
  const axisGroups = {};
  for (const c of allAxisCols) { const g = c.g || 'Other'; (axisGroups[g] = axisGroups[g] || []).push(c); }

  function optHTML(sel) {
    return Object.entries(axisGroups).map(([g, cols]) =>
      `<optgroup label="${g}">${cols.map(c =>
        `<option value="${c.id}"${c.id === sel ? ' selected' : ''}>${c.l}</option>`
      ).join('')}</optgroup>`
    ).join('');
  }

  /* ── State ── */
  let xKey = 'params', yKey = 'ugi', zKey = 'score', colorMode = 'type';

  /* ── Shared style helpers ── */
  const SS   = 'background:var(--bg3);border:1px solid var(--bd);color:var(--t);font:11px IBM Plex Mono,monospace;padding:2px 4px;outline:none';
  const btnS = on => `background:${on?'var(--ac)':'var(--bg3)'};border:1px solid ${on?'var(--ac)':'var(--bd)'};color:${on?'var(--bg)':'var(--t2)'};font:${on?600:500} 10px IBM Plex Mono,monospace;padding:2px 8px;cursor:pointer;transition:all .1s`;

  /* ── Build toolbar + canvas ── */
  el.innerHTML =
    `<div style="padding:5px 10px;border-bottom:1px solid var(--bd);background:var(--bg2);display:flex;align-items:center;gap:8px;flex-shrink:0;flex-wrap:wrap">` +
      `<label style="display:flex;align-items:center;gap:5px;font-size:11px;color:var(--t2)">X <select id="sc-x" style="${SS}">${optHTML('params')}</select></label>` +
      `<label style="display:flex;align-items:center;gap:5px;font-size:11px;color:var(--t2)">Y <select id="sc-y" style="${SS}">${optHTML('ugi')}</select></label>` +
      `<div style="width:1px;height:14px;background:var(--bd);flex-shrink:0"></div>` +
      `<span style="font-size:9px;color:var(--t3);letter-spacing:.08em;text-transform:uppercase">Color</span>` +
      `<button id="cm-type" style="${btnS(true)}">Type</button>` +
      `<button id="cm-col"  style="${btnS(false)}">Column</button>` +
      `<label id="z-wrap" style="display:none;align-items:center;gap:5px;font-size:11px;color:var(--t2)">Z <select id="sc-z" style="${SS}">${optHTML('score')}</select></label>` +
      `<span id="sc-count" style="margin-left:auto;font-size:10px;color:var(--t2)"></span>` +
    `</div>` +
    `<div style="flex:1;position:relative;min-height:0"><canvas id="sc-cv"></canvas></div>` +
    `<div id="z-legend" style="display:none;padding:4px 12px;border-top:1px solid var(--bd);background:var(--bg2);flex-shrink:0;align-items:center;gap:8px;font-size:10px;color:var(--t2)"></div>`;

  /* ── Update toggle button + Z control visibility ── */
  function updateColorUI() {
    const isCol = colorMode === 'column';
    document.getElementById('cm-type').setAttribute('style', btnS(!isCol));
    document.getElementById('cm-col' ).setAttribute('style', btnS( isCol));
    document.getElementById('z-wrap'  ).style.display  = isCol ? 'flex' : 'none';
    document.getElementById('z-legend').style.display  = isCol ? 'flex' : 'none';
  }

  /* ── CSS gradient string for the legend bar ── */
  function viridisGradCSS() {
    return 'linear-gradient(to right,' + [0,0.25,0.5,0.75,1].map(t => `${viridis(t)} ${t*100}%`).join(',') + ')';
  }

  /* ── Per-axis config ── */
  function axisOpts(key) {
    return {
      grid:  { color: '#252528' },
      ticks: {
        color: '#686862',
        font:  { family: 'IBM Plex Mono', size: 9 },
        ...(DATE_KEYS.has(key) ? { callback: v => numToDateLbl(v) } : {}),
      },
    };
  }

  /* ── Display-friendly value ── */
  function fmtV(key, v) { return DATE_KEYS.has(key) ? numToDateLbl(v) : fN(v); }

  /* ── Main draw ── */
  function draw() {
    if (_infoChart) { _infoChart.destroy(); _infoChart = null; }
    let datasets, total = 0;

    if (colorMode === 'type') {
      /* One dataset per model type */
      const byType = {};
      for (const e of D) {
        const x = EG[xKey]?.(e), y = EG[yKey]?.(e);
        if (typeof x !== 'number' || isNaN(x) || typeof y !== 'number' || isNaN(y)) continue;
        const t = modelType(e.model.flags);
        (byType[t] = byType[t] || []).push({ x, y, e });
        total++;
      }
      datasets = typeOrder.filter(t => byType[t]).map(t => ({
        label: t,
        data:  byType[t],
        backgroundColor: typeColors[t] + 'b3',
        pointRadius: 4, pointHoverRadius: 6, pointBorderWidth: 0,
      }));

    } else {
      /* Single dataset, per-point viridis color based on Z column */
      const pts = [];
      for (const e of D) {
        const x = EG[xKey]?.(e), y = EG[yKey]?.(e);
        if (typeof x !== 'number' || isNaN(x) || typeof y !== 'number' || isNaN(y)) continue;
        const z = EG[zKey]?.(e);
        pts.push({ x, y, z: (typeof z === 'number' && !isNaN(z)) ? z : null, e });
        total++;
      }
      const zVals = pts.map(p => p.z).filter(v => v !== null);
      const zMin  = zVals.length ? Math.min(...zVals) : 0;
      const zMax  = zVals.length ? Math.max(...zVals) : 1;
      const zRng  = zMax - zMin || 1;
      const colors = pts.map(p => p.z !== null ? viridis((p.z - zMin) / zRng) : 'rgba(80,80,80,0.35)');
      datasets = [{
        label: allAxisCols.find(c => c.id === zKey)?.l || zKey,
        data:  pts,
        backgroundColor: colors,
        pointRadius: 4, pointHoverRadius: 6, pointBorderWidth: 0,
      }];

      /* Legend bar */
      const zLabel   = allAxisCols.find(c => c.id === zKey)?.l || zKey;
      const legendEl = document.getElementById('z-legend');
      if (legendEl) legendEl.innerHTML =
        `<span style="font-size:9px;color:var(--t3);letter-spacing:.08em;text-transform:uppercase">${zLabel}</span>` +
        `<span>${fmtV(zKey, zMin)}</span>` +
        `<div style="flex:1;max-width:180px;height:8px;background:${viridisGradCSS()};border:1px solid var(--bd);border-radius:1px"></div>` +
        `<span>${fmtV(zKey, zMax)}</span>`;
    }

    document.getElementById('sc-count').textContent = `${total} / ${D.length}`;

    _infoChart = new Chart(document.getElementById('sc-cv'), {
      type: 'scatter',
      data: { datasets },
      options: {
        animation: false,
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: colorMode === 'type'
            ? { labels: { color: '#686862', font: { family: 'IBM Plex Mono', size: 9 }, boxWidth: 8, padding: 12 } }
            : { display: false },
          tooltip: {
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
        },
        onClick: (_, elements) => {
          if (elements.length) openDet(datasets[elements[0].datasetIndex].data[elements[0].index].e);
        },
        scales: { x: axisOpts(xKey), y: axisOpts(yKey) },
      },
    });
  }

  /* ── Wire controls ── */
  document.getElementById('cm-type').onclick = () => { colorMode = 'type';   updateColorUI(); draw(); };
  document.getElementById('cm-col' ).onclick = () => { colorMode = 'column'; updateColorUI(); draw(); };
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