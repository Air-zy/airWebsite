function dot(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

function norm(a) {
  return Math.sqrt(dot(a, a));
}

function cosineDist(a, b) {
  const n = norm(a) * norm(b);
  return n > 0 ? 1 - dot(a, b) / n : 1;
}

function euclid(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += (a[i] - b[i]) ** 2;
  return Math.sqrt(s);
}

//

function buildKNNGraph(embeddings, k = 15) {
  const n = embeddings.length;
  const neighbors = Array.from({ length: n }, () => []);

  for (let i = 0; i < n; i++) {
    // compute distances to all other points
    const dists = embeddings.map((e, j) => ({ j, d: cosineDist(embeddings[i], e) }));
    dists.sort((a, b) => a.d - b.d);
    // skip self, take k nearest
    for (let t = 1; t <= k; t++) {
      neighbors[i].push({ j: dists[t].j, d: dists[t].d });
    }
  }
  return neighbors;
}

//

function computeEdgeProbs(neighbors, a = 1.0, b = 1.0) {
  // simplified version of UMAP’s fuzzy set probability
  return neighbors.map((nbrs) =>
    nbrs.map(({ j, d }) => ({ j, p: 1 / (1 + a * d ** (2 * b)) }))
  );
}

//

function initPositions(n, dim = 2) {
  return Array.from({ length: n }, () => Array.from({ length: dim }, () => Math.random() - 0.5));
}

//

function umapGD(neighborsProb, positions, iterations = 500, lr = 0.1) {
  const n = positions.length;
  const dim = positions[0].length;

  for (let it = 0; it < iterations; it++) {
    console.log("iter:", it)
    for (let i = 0; i < n; i++) {
      const posI = positions[i];
      neighborsProb[i].forEach(({ j, p }) => {
        const posJ = positions[j];
        const dist = euclid(posI, posJ);
        const gradCoeff = 2 * (dist > 0 ? (dist - (1 - p)) / dist : 0);

        for (let d = 0; d < dim; d++) {
          const grad = gradCoeff * (posI[d] - posJ[d]);
          posI[d] -= lr * grad;
          posJ[d] += lr * grad; // push-pull effect
        }
      });
    }
  }

  return positions;
}

//

export function umap2D(embeddingsArray, k = 15) {
  const neighbors = buildKNNGraph(embeddingsArray, k);
  console.log("neighbors gen")
  const neighborsProb = computeEdgeProbs(neighbors);
  console.log("got edge probs")
  const positions = initPositions(embeddingsArray.length, 2);
  console.log("pos")
  return umapGD(neighborsProb, positions, 1000, 0.01);
}


//

export function mdsMain(map, nodes) {
    /*const embeddingsArray = nodes.map(id => {
        const emb = map[id]?.embd;
        if (!emb) return null;
        return Object.values(emb.u).map(x => x);// * emb.q); //
    }).filter(e => e !== null);

    console.log("got embeddings array", embeddingsArray.length);

    nodes.forEach((id, i) => {
        const [x, y] = coords2D[i];
        if (map[id]) {
        map[id].pos = { x, y };
        }
    });*/

    nodes.forEach(id => {
        const emb = map[id]?.embd;
        if (emb) {
            // Take the first two values of emb.u as x and y
            const values = Object.values(emb.u);
            const x = values[126] ?? 0; // fallback to 0 if undefined
            const y = values[127] ?? 0;
            map[id].pos = { x, y };
        }
    });
}
