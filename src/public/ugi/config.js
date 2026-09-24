/* config.js, everything UGI specific. The rest of this folder is the engine ../caliper shares */

const CSV = 'https://huggingface.co/spaces/DontPlanToEnd/UGI-Leaderboard/raw/main/ugi-leaderboard-data.csv';

const NAME = 'ugi';                 /* localStorage prefix */
const MAIN = 'ugi';                 /* SCORE when no weights are set */
const DEFAULT_COLS = ['rank','name','score','ugi','writing','natint','w10','params'];
const CHART_AXES = ['natint', 'dialogue'];
const REC_COLS = ['ugi', 'writing'];
const LOWER_BETTER = new Set([
  'recipe_err','geo_mae','weight_err','music_mae',
  'len_err','wc_exceeded','sem_red','lex_stuck','showmae','showstd',
]);

async function loadData() {
  const res = await fetch(CSV);
  return pCSV(await res.text()).map(fmtE).filter(e => e.model.name);
}

const WG = [
  {g:'Main',items:[
    {k:'ugi',l:'UGI',get:e=>e.scores.ugi},
    {k:'writing',l:'Writing',get:e=>e.scores.writing},
    {k:'natint',l:'NatInt',get:e=>e.scores.natint},
    {k:'w10',l:'W/10',get:e=>e.scores.w10.overall},
    {k:'w10d',l:'W/10-D',get:e=>e.scores.w10.direct},
    {k:'w10a',l:'W/10-A',get:e=>e.scores.w10.adherence},
  ]},
  {g:'UGI',items:[
    {k:'sens',l:'Sensitive',get:e=>e.ugi_breakdown.sensitive_info},
    {k:'haz',l:'Hazardous',get:e=>e.ugi_breakdown.hazardous},
    {k:'ent',l:'Entertain',get:e=>e.ugi_breakdown.entertainment},
    {k:'socpol',l:'SocPol',get:e=>e.ugi_breakdown.socpol},
    {k:'nsfw',l:'NSFW',get:e=>e.ugi_breakdown.nsfw_score},
    {k:'dark',l:'Dark',get:e=>e.ugi_breakdown.dark_score},
  ]},
  {g:'NatInt',items:[
    {k:'textbook',l:'Textbook',get:e=>e.natint_breakdown.textbook},
    {k:'popculture',l:'Pop Cult',get:e=>e.natint_breakdown.pop_culture},
    {k:'worldmodel',l:'World Mdl',get:e=>e.natint_breakdown.world_model},
    {k:'recipe_err',l:'Recipe Err',get:e=>e.natint_breakdown.recipe_err},
    {k:'geo_mae',l:'Geo MAE',get:e=>e.natint_breakdown.geo_mae},
  ]},
  {g:'Writing',items:[
    {k:'style',l:'Style',get:e=>e.writing.style_score},
    {k:'orig',l:'Originality',get:e=>e.writing.originality},
    {k:'readability',l:'Readability',get:e=>e.writing.readability_grade},
    {k:'dialogue',l:'Dialogue%',get:e=>e.writing.dialogue_pct},
    {k:'sem_red',l:'Sem Redund',get:e=>e.writing.semantic_redundancy},
    {k:'lex_stuck',l:'Lex Stuck',get:e=>e.writing.lexical_stuckness},
    {k:'len_err',l:'Length Err',get:e=>e.writing.length_error_pct},
  ]},
  {g:'ShowRec',items:[
    {k:'showrec',l:'Show Rec',get:e=>e.show_rec.score},
    {k:'showmae',l:'Show MAE',get:e=>e.show_rec.mae},
    {k:'showcorr',l:'Correlation',get:e=>e.show_rec.correlation},
  ]},
  {g:'Info',items:[
    {k:'released',l:'Released',get:e=>pDate(e.model.released)},
    {k:'tested',l:'Tested',get:e=>pDate(e.model.tested)},
    {k:'active',l:'Active',get:e=>e.model.params.active},
    {k:'total',l:'Total',get:e=>e.model.params.total},
  ]},
  {g:'Political',items:[
    {k:'lean',l:'Lean %',get:e=>e.political.lean},
    {k:'dipl',l:'Diplomacy %',get:e=>e.political.compass.dipl},
    {k:'govt',l:'Govt %',get:e=>e.political.compass.govt},
    {k:'econ',l:'Econ %',get:e=>e.political.compass.econ},
    {k:'scty',l:'Society %',get:e=>e.political.compass.scty},
  ]},
];

const G = {};
WG.forEach(g => g.items.forEach(i => G[i.k] = i.get));
Object.assign(G, {
  ugi_no_w10: e => e.scores.ugi_no_w10,
  params: e => e.model.params.active,
  total_params: e => e.model.params.total,
  arch: e => e.model.architecture,
  template: e => e.model.template,
  released: e => pDate(e.model.released),
  tested: e => pDate(e.model.tested),
  weight_err: e => e.natint_breakdown.weight_err,
  music_mae: e => e.natint_breakdown.music_mae,
  verb_noun: e => e.writing.verb_noun_ratio,
  adj_adv: e => e.writing.adj_adv_pct,
  wc_exceeded: e => e.writing.wc_exceeded_pct,
  showstd: e => e.show_rec.std_dev,
  lean: e => e.political.lean,
  ideology: e => e.political.ideology,
  dipl: e => e.political.compass.dipl,
  govt: e => e.political.compass.govt,
  econ: e => e.political.compass.econ,
  scty: e => e.political.compass.scty,
});

const CL = [
  {id:'rank',l:'#',a:1,cls:'rk nm',tip:'Rank by current sort/weights'},
  {id:'name',l:'MODEL',a:1,cls:'nc',tip:'Model name (author/model_name)'},
  {id:'score',l:'SCORE',a:1,cls:'sc nm',tip:'Weighted score using your column weights'},
  {id:'ugi',l:'UGI',cls:'nm',g:'Main',tip:'UGI score (overall)'},
  {id:'ugi_no_w10',l:'UGI-W10',cls:'nm',g:'Main',tip:'UGI excluding W/10 questions'},
  {id:'writing',l:'WRITE',cls:'nm',g:'Main',tip:'Writing score'},
  {id:'natint',l:'NATINT',cls:'nm',g:'Main',tip:'NatInt score (natural intelligence)'},
  {id:'w10',l:'W/10',cls:'nm',g:'Main',tip:'Willingness/10 — overall'},
  {id:'w10d',l:'W/10-D',cls:'nm',g:'Main',tip:'W/10 — direct requests'},
  {id:'w10a',l:'W/10-A',cls:'nm',g:'Main',tip:'W/10 — adherence'},
  {id:'params',l:'PARAMS',cls:'nm',g:'Info',tip:'Active parameters (B)'},
  {id:'total_params',l:'TOTAL',cls:'nm',g:'Info',tip:'Total parameters (B)'},
  {id:'arch',l:'ARCH',g:'Info',tip:'Architecture'},
  {id:'template',l:'TMPL',g:'Info',tip:'Prompt template'},
  {id:'released',l:'REL',cls:'nm',g:'Info',t:'date',tip:'Release date (newer = higher value when weighted)'},
  {id:'tested',l:'TESTED',cls:'nm',g:'Info',t:'date',tip:'Test date (newer = higher value when weighted)'},
  {id:'sens',l:'SENS',cls:'nm',g:'UGI',tip:'Sensitive info sub-score'},
  {id:'haz',l:'HAZ',cls:'nm',g:'UGI',tip:'Hazardous sub-score'},
  {id:'ent',l:'ENT',cls:'nm',g:'UGI',tip:'Entertainment sub-score'},
  {id:'socpol',l:'SOCPOL',cls:'nm',g:'UGI',tip:'Social/political sub-score'},
  {id:'nsfw',l:'NSFW',cls:'nm',g:'UGI',tip:'NSFW sub-score'},
  {id:'dark',l:'DARK',cls:'nm',g:'UGI',tip:'Dark sub-score'},
  {id:'textbook',l:'TEXTBK',cls:'nm',g:'NatInt',tip:'Textbook knowledge'},
  {id:'popculture',l:'POP',cls:'nm',g:'NatInt',tip:'Pop culture knowledge'},
  {id:'worldmodel',l:'WORLD',cls:'nm',g:'NatInt',tip:'World model knowledge'},
  {id:'recipe_err',l:'RECIPE',cls:'nm',g:'NatInt',tip:'Recipe error % (lower = better)'},
  {id:'geo_mae',l:'GEO',cls:'nm',g:'NatInt',tip:'Geo-guesser MAE (lower = better)'},
  {id:'weight_err',l:'WT-ERR',cls:'nm',g:'NatInt',tip:'Weight estimation error (lower = better)'},
  {id:'music_mae',l:'MUSIC',cls:'nm',g:'NatInt',tip:'Music MAE (lower = better)'},
  {id:'style',l:'STYLE',cls:'nm',g:'Writing',tip:'Writing style score'},
  {id:'orig',l:'ORIG',cls:'nm',g:'Writing',tip:'Originality score'},
  {id:'readability',l:'READ',cls:'nm',g:'Writing',tip:'Readability grade level'},
  {id:'dialogue',l:'DIAL%',cls:'nm',g:'Writing',tip:'Dialogue % of writing samples'},
  {id:'verb_noun',l:'V/N',cls:'nm',g:'Writing',tip:'Verb-to-noun ratio'},
  {id:'adj_adv',l:'ADJ%',cls:'nm',g:'Writing',tip:'Adjective/adverb %'},
  {id:'len_err',l:'LEN-ERR',cls:'nm',g:'Writing',tip:'Length error % (lower = better)'},
  {id:'wc_exceeded',l:'WC-EX',cls:'nm',g:'Writing',tip:'Word count exceeded % (lower = better)'},
  {id:'sem_red',l:'SEM-RED',cls:'nm',g:'Writing',tip:'Semantic redundancy (lower = better)'},
  {id:'lex_stuck',l:'LEX-STK',cls:'nm',g:'Writing',tip:'Lexical stuckness (lower = better)'},
  {id:'showrec',l:'SH-REC',cls:'nm',g:'ShowRec',tip:'Show recommendation score'},
  {id:'showmae',l:'SH-MAE',cls:'nm',g:'ShowRec',tip:'Show recommendation MAE (lower = better)'},
  {id:'showstd',l:'SH-STD',cls:'nm',g:'ShowRec',tip:'Show recommendation std dev (lower = better)'},
  {id:'showcorr',l:'SH-CORR',cls:'nm',g:'ShowRec',tip:'Show recommendation correlation'},
  {id:'lean',l:'LEAN%',cls:'nm',g:'Political',tip:'Political lean (-100% = left, +100% = right)'},
  {id:'ideology',l:'IDEO',g:'Political',tip:'12axes ideology (label)'},
  {id:'dipl',l:'DIPL%',cls:'nm',g:'Political',tip:'Diplomatic axis % (12axes)'},
  {id:'govt',l:'GOVT%',cls:'nm',g:'Political',tip:'Government axis % (12axes)'},
  {id:'econ',l:'ECON%',cls:'nm',g:'Political',tip:'Economic axis % (12axes)'},
  {id:'scty',l:'SCTY%',cls:'nm',g:'Political',tip:'Society axis % (12axes)'},
];

function detGroups(e) {
  const m = e.model;
  return [
    {n:'Model', i:[
      ['Arch', m.architecture||'–', null],
      ['Params', fP(m.params.active)+' / '+fP(m.params.total), null],
      ['Flags', flagText(m.flags), null],
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
}

/* Atomic features behind the similarity map and recommendations */
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
