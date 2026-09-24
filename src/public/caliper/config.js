/* config.js, caliperbench.com on the ../ugi engine. Every column comes from their own list
   through /api/caliper, so new or renamed ones show up without edits here */

const NAME = 'caliper';
let MAIN;
const DEFAULT_COLS = ['rank','name','score','params'];
const CHART_AXES = [], REC_COLS = CHART_AXES;
const CL = [
  {id:'rank',l:'#',a:1,cls:'rk nm',tip:'Rank by current sort/weights'},
  {id:'name',l:'MODEL',a:1,cls:'nc',tip:'Model name'},
  {id:'score',l:'SCORE',a:1,cls:'sc nm',tip:'Weighted score using your column weights'},
  {id:'params',l:'Params',cls:'nm',g:'Main',tip:'Parameters in billions, blank for closed models'},
];
const G = { params: e => e.model.params.active };
const LOWER_BETTER = new Set();
const MAP_FEATURES = [];

async function loadData() {
  const { cols, rows } = await (await fetch('/api/caliper')).json();

  /* their key columns are Main like on their site, the similarity map runs on the rest */
  for (const c of cols) {
    if (c.field === 'rank' || c.field === 'parameter_count_b') continue;
    const k = c.percent ? 100 : c.scale || 1;
    CL.push({ id: c.field, l: c.label, cls: 'nm', g: c.default ? 'Main' : 'More', tip: c.description });
    G[c.field] = e => (e.v[c.field] ?? NaN) * k;
    if (c.direction === 'down') LOWER_BETTER.add(c.field);
    if (c.default) DEFAULT_COLS.push(c.field);
    else MAP_FEATURES.push({ l: c.label, get: G[c.field] });
  }

  /* headline scores are their key columns where higher wins, CW then RP today */
  CHART_AXES.push(...cols.filter(c => c.default && c.direction === 'up').slice(0, 2).map(c => c.field));
  MAIN = CHART_AXES[0];

  return rows.map(r => {
    const k = r.model_class;
    return {
      model: {
        name: r.display_name,
        link: r.huggingface_url?.startsWith('https://') ? r.huggingface_url : '',
        lineage: r.lineage,
        family: r.family,
        params: { active: r.parameter_count_b || NaN },
        flags: { thinking: !!r.is_reasoning, finetuned: k === 'Finetune', merged: k === 'Merge', foundation: k === 'Base', open: k !== 'Proprietary' },
      },
      v: r,
    };
  });
}

function detGroups(e) {
  const m = e.model, gs = {};
  for (const c of CL) if (c.g && c.id !== 'params') (gs[c.g] ??= []).push([c.l, G[c.id](e), c.id]);
  return [
    {n:'Model', i:[['Lineage', m.lineage], ['Family', m.family], ['Params', fP(m.params.active)], ['Flags', flagText(m.flags)]]},
    ...Object.entries(gs).map(([n, i]) => ({ n, i })),
  ];
}

function renderAbout() {
  const main = CL.filter(c => c.g === 'Main' && c.tip);
  document.getElementById('about-benchmarks').innerHTML = `
    <div class="about-inner">
      <h3 class="about-h">About Caliper Bench</h3>
      <p class="about-p">All scores come from <a href="https://caliperbench.com/" target="_blank" class="about-link">caliperbench.com</a>, which benchmarks models on creative writing and roleplay craft instead of raw intelligence. This page rereads their board every hour. How each score is built is on their <a href="https://caliperbench.com/methodology.html" target="_blank" class="about-link">methodology</a> page.</p>
      <p class="about-section-title">Key columns</p>
      <ul class="about-ul">${main.map(c => `<li><strong>${c.l}:</strong> ${c.tip}</li>`).join('')}</ul>
      <p class="about-p about-note">Everything else they measure is under More in the sidebar. Hover a column header to see what it measures.</p>
    </div>`;
}
