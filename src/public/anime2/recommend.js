// ---------- helpers (reuse/replace with your existing ones) ----------
function uToArray(emb) {
  if (!emb || !emb.u) return [];
  if (Array.isArray(emb.u)) return emb.u.slice();
  const keys = Object.keys(emb.u).map(Number).sort((a,b)=>a-b);
  return keys.map(k => emb.u[k] ?? 0);
}

// Optional: apply an importance weighting across dimensions (simulates Σ)
// If you actually have per-dimension sigma array, pass it in opts.sigmas
function applyDimWeights(vec, opts = {}) {
  const d = vec.length;
  const out = new Array(d);
  if (opts.sigmas && Array.isArray(opts.sigmas)) {
    for (let i = 0; i < d; i++) out[i] = vec[i] * (opts.sigmas[i] ?? 0);
    return out;
  }
  // fallback synthetic decay: power-law or exp
  const method = opts.weightMethod || 'power'; // 'power' or 'exp'
  const p = typeof opts.p === 'number' ? opts.p : 1.0;      // power exponent
  const alpha = typeof opts.alpha === 'number' ? opts.alpha : 0.5; // exp decay
  if (method === 'exp') {
    for (let i = 0; i < d; i++) out[i] = vec[i] * Math.exp(-alpha * i);
  } else {
    for (let i = 0; i < d; i++) out[i] = vec[i] / Math.pow(i + 1, p);
  }
  return out;
}

function dot(a,b){
  let s=0;
  const L = Math.min(a.length, b.length);
  for (let i=0;i<L;i++) s += a[i]*b[i];
  return s;
}
function norm(a){ return Math.sqrt(dot(a,a)); }
function cosineSim(a,b){
  const EPS = 1e-12;
  const d = Math.min(a.length,b.length);
  if (d === 0) return 0;
  let n = dot(a,b);
  let na = norm(a), nb = norm(b);
  if (na <= EPS && nb <= EPS) return 1; // both zero: identical
  if (na <= EPS || nb <= EPS) return 0; // one zero: treat as dissimilar
  return Math.max(-1, Math.min(1, n / (na * nb)));
}
function euclidean(a,b){
  const L = Math.min(a.length,b.length);
  let s=0;
  for (let i=0;i<L;i++){ const d=a[i]-b[i]; s+=d*d; }
  return Math.sqrt(s);
}
function meanAbsDiff(a,b){
  const L = Math.min(a.length,b.length);
  if (L===0) return 0;
  let s=0;
  for (let i=0;i<L;i++) s += Math.abs(a[i]-b[i]);
  return s / L;
}

// normalize vector to unit length (in-place copy)
function l2normalize(v){
  const n = norm(v) || 1;
  return v.map(x => x / n);
}

// ---------- main recommender ----------
/**
 * recommend(seedIds, map, options) -> [{id, score, simMethod}]
 *
 * map: { id: { embd: { q, u: {...} }, ... }, ... }
 * seedIds: array of ids (numbers or strings)
 *
 * options:
 *   - topK: number to return (default 20)
 *   - metric: "cosine"|"euclid"|"meanabs" (default "cosine")
 *   - scoring: "centroid"|"max"|"avgTop"|"ensemble" (default "centroid")
 *   - useWeights: true/false (apply dim weighting simulating Σ) default true
 *   - weightOpts: passed to applyDimWeights
 *   - mmr: { enabled: true, lambda: 0.7 }  (default disabled)
 *   - excludeSeeds: true/false (default true)
 *   - candidateIds: optional array of ids to consider (default all keys of map)
 */
function recommend(seedIds, map, options = {}) {
  const opts = Object.assign({
    topK: 20,
    metric: 'cosine',
    scoring: 'centroid',
    useWeights: true,
    weightOpts: { method: 'power', p: 1.0 },
    mmr: { enabled: false, lambda: 0.7 },
    excludeSeeds: true,
    candidateIds: null
  }, options);

  const candidates = opts.candidateIds || Object.keys(map).map(k=>k);
  const seedSet = new Set(seedIds.map(String));
  const seedVecs = [];

  for (const sid of seedIds) {
    const emb = map[sid];
    if (!emb || !emb.embd) continue;
    let v = uToArray(emb.embd);
    if (opts.useWeights) v = applyDimWeights(v, opts.weightOpts);
    // (optional) normalize seeds so centroid isn't dominated by magnitude
    if (opts.metric === 'cosine') v = l2normalize(v);
    seedVecs.push({ id: sid, vec: v });
  }
  if (seedVecs.length === 0) return [];

  // Build query vector depending on scoring method
  let queryVec = null;
  if (opts.scoring === 'centroid' || opts.scoring === 'ensemble') {
    // mean of seed vectors (in same dim)
    const D = Math.max(...seedVecs.map(s=>s.vec.length));
    const mean = new Array(D).fill(0);
    for (const s of seedVecs) {
      for (let i=0;i<s.vec.length;i++) mean[i] += s.vec[i];
    }
    for (let i=0;i<D;i++) mean[i] /= seedVecs.length;
    if (opts.metric === 'cosine') queryVec = l2normalize(mean); else queryVec = mean;
  }

  // Precompute similarities of each candidate to seeds
  const scored = [];
  for (const cidRaw of candidates) {
    const cid = String(cidRaw);
    if (opts.excludeSeeds && seedSet.has(cid)) continue;
    const entry = map[cid];
    if (!entry || !entry.embd) continue;
    let v = uToArray(entry.embd);
    if (opts.useWeights) v = applyDimWeights(v, opts.weightOpts);
    if (opts.metric === 'cosine') v = l2normalize(v);

    let score = 0;
    if (opts.scoring === 'centroid') {
      if (!queryVec) continue;
      score = (opts.metric === 'cosine') ? cosineSim(v, queryVec) : -euclidean(v, queryVec);
      // note: for euclidean we negate so higher is better for uniformity
    } else if (opts.scoring === 'max') {
      let best = -Infinity;
      for (const s of seedVecs) {
        const val = opts.metric === 'cosine' ? cosineSim(v, s.vec) : -euclidean(v, s.vec);
        if (val > best) best = val;
      }
      score = best;
    } else if (opts.scoring === 'avgTop') {
      const sims = seedVecs.map(s => (opts.metric === 'cosine' ? cosineSim(v,s.vec) : -euclidean(v,s.vec)));
      sims.sort((a,b)=>b-a);
      const K = Math.min(3, sims.length);
      score = sims.slice(0,K).reduce((a,b)=>a+b,0)/K;
    } else if (opts.scoring === 'ensemble') {
      // combine centroid + max (weighted)
      const simCent = (opts.metric === 'cosine') ? cosineSim(v, queryVec) : -euclidean(v, queryVec);
      let best = -Infinity;
      for (const s of seedVecs) {
        const val = opts.metric === 'cosine' ? cosineSim(v, s.vec) : -euclidean(v, s.vec);
        if (val > best) best = val;
      }
      score = 0.6 * simCent + 0.4 * best; // tune weights if you want
    }

    scored.push({ id: cid, vec: v, score });
  }

  // Sort by raw score descending
  scored.sort((a,b)=>b.score - a.score);

  // Optional: apply MMR to pick topK with diversity
  const topK = Math.max(1, Math.min(opts.topK, scored.length));
  if (opts.mmr && opts.mmr.enabled) {
    const lambda = (typeof opts.mmr.lambda === 'number') ? opts.mmr.lambda : 0.7;
    const picked = [];
    const pool = scored.map(s => ({...s})); // copy
    // For initial pick, choose highest-scoring
    if (pool.length === 0) return [];
    picked.push(pool.shift()); // remove top
    while (picked.length < topK && pool.length > 0) {
      let bestIdx = -1;
      let bestVal = -Infinity;
      for (let i = 0; i < pool.length; i++) {
        const candidate = pool[i];
        // relevance term: use candidate.score (already relative to seeds/centroid)
        const rel = candidate.score;
        // diversity term: maximum similarity to any already picked
        let maxSim = -Infinity;
        for (const p of picked) {
          const sim = (opts.metric === 'cosine') ? cosineSim(candidate.vec, p.vec) : -euclidean(candidate.vec, p.vec);
          if (sim > maxSim) maxSim = sim;
        }
        // for uniformity, if metric was euclid we negated earlier — keep using same sign
        const mmrScore = lambda * rel - (1 - lambda) * maxSim;
        if (mmrScore > bestVal) { bestVal = mmrScore; bestIdx = i; }
      }
      picked.push(pool.splice(bestIdx,1)[0]);
    }
    return picked.slice(0, topK).map(p => ({ id: p.id, score: p.score }));
  }

  // No MMR: just return topK by score
  return scored.slice(0, topK).map(s => ({ id: s.id, score: s.score }));
}
