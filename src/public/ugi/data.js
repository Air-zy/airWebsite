/* data.js — CSV parsing, entry formatting, number helpers */

/* Format a float to 2 decimal places or '–' */
function fN(v) {
  return isNaN(v) || v === null ? '–' : v.toFixed(2);
}

/* Format parameter counts as e.g. '7B', '70B', '1.2T' */
function fP(v) {
  if (isNaN(v) || v === null) return '–';
  if (v >= 1000) return (v / 1000).toFixed(1) + 'T';
  if (v >= 1)    return v.toFixed(v >= 100 ? 0 : 1) + 'B';
  return (v * 1000).toFixed(0) + 'M';
}

/* Bucket active param count into a readable band */
function buckParam(p) {
  if (isNaN(p) || p === null) return '—';
  if (p <   1)  return '< 1B';
  if (p <   4)  return '1–4B';
  if (p <   8)  return '4–8B';
  if (p <  15)  return '8–15B';
  if (p <  35)  return '15–35B';
  if (p <  75)  return '35–75B';
  if (p < 200)  return '75–200B';
  return '200B+';
}

/* Parse one CSV row respecting quoted commas */
function pRow(r) {
  const v = []; let c = '', q = false;
  for (const ch of r) {
    if (ch === '"') q = !q;
    else if (ch === ',' && !q) { v.push(c.trim()); c = ''; }
    else c += ch;
  }
  v.push(c.trim());
  return v;
}

/* Parse full CSV text → array of raw row objects */
function pCSV(t) {
  const [h, ...rs] = t.trim().split(/\r?\n/);
  const ks = pRow(h);
  return rs.map(r => {
    const vs = pRow(r), o = {};
    ks.forEach((k, i) => o[k] = vs[i] ?? '');
    return o;
  });
}

/* Map a raw CSV row to the structured entry object */
function fmtE(r) {
  const n = k => parseFloat(r[k]);
  const b = k => r[k]?.toLowerCase() === 'true';
  return {
    model: {
      name:         r['author/model_name'],
      link:         r['Model Link'],
      released:     r['Release Date'],
      tested:       r['Test Date'],
      template:     r['Prompt Template'],
      params:       { active: n('Active Parameters'), total: n('Total Parameters') },
      flags:        { finetuned: b('Is Finetuned'), merged: b('Is Merged'), foundation: b('Is Foundation'), thinking: b('Is Thinking Model') },
      architecture: r['Architecture'],
    },
    scores: {
      ugi:       n('UGI 🏆'),
      ugi_no_w10:n('UGI non-W/10'),
      writing:   n('Writing ✍️'),
      natint:    n('NatInt 💡'),
      w10:       { overall: n('W/10 👍'), direct: n('W/10-Direct'), adherence: n('W/10-Adherence') },
    },
    writing: {
      style_score:          n('avg_writing_style_score'),
      originality:          n('originality_score'),
      readability_grade:    n('Readability_Grade_Level'),
      dialogue_pct:         n('Dialogue_Percentage'),
      verb_noun_ratio:      n('Verb_to_Noun_Ratio'),
      adj_adv_pct:          n('Adjective_Adverb_Percentage'),
      length_error_pct:     n('avg_length_error_pct'),
      wc_exceeded_pct:      n('creative_writing_wc_exceeded_pct'),
      semantic_redundancy:  n('internal_semantic_redundancy'),
      lexical_stuckness:    n('lexical_stuckness'),
    },
    ugi_breakdown: {
      sensitive_info: n('Sensitive Info'),
      hazardous:      n('Hazardous'),
      entertainment:  n('Entertainment'),
      socpol:         n('SocPol'),
      nsfw_score:     n('avg_nsfw_score'),
      dark_score:     n('avg_dark_score'),
    },
    natint_breakdown: {
      textbook:     n('Textbook'),
      pop_culture:  n('Pop Culture'),
      world_model:  n('World Model'),
      recipe_err:   n('wm_recipe_percent_error'),
      geo_mae:      n('wm_geoguesser_mae'),
      weight_err:   n('wm_weight_percent_error'),
      music_mae:    n('wm_music_mae'),
    },
    show_rec: {
      score:      n('Show Rec Score'),
      mae:        n('Show Rec MAE'),
      std_dev:    n('Show Rec Std Dev Error'),
      correlation:n('Show Rec Correlation'),
    },
    political: {
      lean:    r['Political Lean 📋'],
      ideology:r['12axes Ideology'],
      compass: { dipl: r['dipl'], govt: r['govt'], econ: r['econ'], scty: r['scty'] },
    },
  };
}