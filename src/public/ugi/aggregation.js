/* aggregation.js — group-by aggregation view */

aVC = new Set(['ugi', 'writing', 'natint', 'w10', 'params']);

let aggSC = null, aggSD = -1;
let _aggBuckets = null;

function computeQuantileBuckets(vals, n = 7) {
  const sorted = vals.filter(v => !isNaN(v) && v !== null).sort((a, b) => a - b);
  if (sorted.length < 2) return [];
  const edges = [];
  for (let i = 1; i < n; i++) {
    const idx = Math.round(sorted.length * i / n);
    edges.push(sorted[Math.min(idx, sorted.length - 1)]);
  }
  return [...new Set(edges)];
}

function dynBucket(v, edges, fmt) {
  if (isNaN(v) || v === null) return '—';
  for (const edge of edges) if (v <= edge) return `≤ ${fmt(edge)}`;
  return `> ${fmt(edges[edges.length - 1])}`;
}

function aggKey(e, grp) {
  switch (grp) {
    case 'architecture':   return e.model.architecture || '—';
    case 'paramSize':      return _aggBuckets ? dynBucket(e.model.params.active, _aggBuckets, v => v.toFixed(1) + 'B') : buckParam(e.model.params.active);
    case 'totalParamSize': return _aggBuckets ? dynBucket(e.model.params.total,  _aggBuckets, v => v.toFixed(1) + 'B') : buckParam(e.model.params.total);
    case 'type':           return modelType(e.model.flags);
    case 'template':       return e.model.template || '—';
    case 'released': { const v = pDate(e.model.released); return isNaN(v) ? '—' : fDateMonth(v); }
    case 'tested':   { const v = pDate(e.model.tested);   return isNaN(v) ? '—' : fDateMonth(v); }
    case 'originality': {
      const ov = e.writing.originality;
      return _aggBuckets ? dynBucket(ov, _aggBuckets, v => (v * 100).toFixed(0)) : buckOriginality(ov * 100);
    }
    default: return '—';
  }
}

function buckOriginality(v) {
  if (isNaN(v) || v === null) return '—';
  if (v < 20) return '< 20';
  if (v < 40) return '20–40';
  if (v < 60) return '40–60';
  if (v < 80) return '60–80';
  return '80+';
}

function modelType(f) {
  if (f.thinking)   return 'Thinking';
  if (f.finetuned)  return 'Finetuned';
  if (f.merged)     return 'Merged';
  if (f.foundation) return 'Foundation';
  return 'Other';
}

const visAF = () => AF.filter(c => aVC.has(c.k));

function renderAgg() {
  const grp = document.getElementById('agrp').value;
  const data = filt();
  const cols = visAF();

  if (grp === 'paramSize')      _aggBuckets = computeQuantileBuckets(data.map(e => e.model.params.active));
  else if (grp === 'totalParamSize') _aggBuckets = computeQuantileBuckets(data.map(e => e.model.params.total));
  else if (grp === 'originality')    _aggBuckets = computeQuantileBuckets(data.map(e => e.writing.originality));
  else _aggBuckets = null;

  const groups = {};
  for (const e of data) {
    const k = aggKey(e, grp);
    if (!groups[k]) groups[k] = [];
    groups[k].push(e);
  }

  const numFromLabel = l => {
    if (l === '—') return Infinity;
    const m = l.match(/[\d.]+/);
    const n = m ? parseFloat(m[0]) : Infinity;
    return l.startsWith('>') ? n + 0.00001 : n;
  };

  const keys = Object.keys(groups).sort((a, b) => {
    if (_aggBuckets) return numFromLabel(a) - numFromLabel(b);
    return a.localeCompare(b);
  });

  const rows = keys.map(k => {
    const entries = groups[k];
    const avgs = cols.map(c => {
      const vals = entries.map(e => c.get(e)).filter(v => !isNaN(v) && v !== null);
      return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : NaN;
    });
    return { k, count: entries.length, avgs };
  });

  if (aggSC !== null) {
    rows.sort((a, b) => {
      if (aggSC === '__count') return aggSD * (a.count - b.count);
      const ci = cols.findIndex(c => c.k === aggSC);
      if (ci === -1) return 0;
      const av = isNaN(a.avgs[ci]) ? -Infinity : a.avgs[ci];
      const bv = isNaN(b.avgs[ci]) ? -Infinity : b.avgs[ci];
      return aggSD * (av - bv);
    });
  }

  const ath = document.getElementById('ath');
  const sortIcon = k => aggSC === k ? (aggSD === -1 ? ' ▾' : ' ▴') : '';
  ath.innerHTML = '<tr>' +
    `<th class="nm" data-ac="__group" style="cursor:pointer">Group${sortIcon('__group')}</th>` +
    `<th class="nm" data-ac="__count" style="cursor:pointer">#${sortIcon('__count')}</th>` +
    cols.map(c => `<th class="nm" data-ac="${c.k}" style="cursor:pointer">${c.l}${sortIcon(c.k)}</th>`).join('') +
    '</tr>';

  const atb = document.getElementById('atb');
  atb.innerHTML = rows.map(({ k, count, avgs }) => {
    const cells = avgs.map((avg, i) => cols[i].t === 'date' ? `<td class="nm">${fDate(avg)}</td>` : `<td class="nm">${fN(avg)}</td>`).join('');
    return `<tr><td>${k}</td><td class="nm">${count}</td>${cells}</tr>`;
  }).join('');

  document.getElementById('status').textContent = `${data.length} / ${D.length}`;
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('agrp').onchange = () => { aggSC = null; renderAgg(); };
  document.getElementById('ath').addEventListener('click', e => {
    const th = e.target.closest('th[data-ac]');
    if (!th) return;
    const c = th.dataset.ac;
    if (c === '__group') return;
    if (aggSC === c) aggSD = -aggSD; else { aggSC = c; aggSD = -1; }
    renderAgg();
  });
});
