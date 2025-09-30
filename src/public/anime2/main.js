function buildGraph(map) {
  const graph = new Map(); // nodeId:number -> Map(neighborId:number -> weight:number)

  for (const [srcIdRaw, srcNode] of Object.entries(map)) {
    const srcId = Number(srcIdRaw);

    for (const { id: trgtIdRaw, v: weight } of srcNode.recoms) {
      const trgtId = Number(trgtIdRaw);
      if (!map[trgtId]) continue; // recom must exist in map

      // Ensure both nodes exist in the graph
      if (!graph.has(srcId))  graph.set(srcId,  new Map());
      if (!graph.has(trgtId)) graph.set(trgtId, new Map());

      const srcNeighbors  = graph.get(srcId);
      const trgtNeighbors = graph.get(trgtId);

      srcNeighbors.set(trgtId, (srcNeighbors.get(trgtId) || 0) + weight);
      trgtNeighbors.set(srcId, (trgtNeighbors.get(srcId) || 0) + weight);
    }
  }

  return graph;
}


function normalizeEmbeddings(embeddings, size) {
  const xs = embeddings.map(e => e[0]);
  const ys = embeddings.map(e => e[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);

  return embeddings.map(([x, y]) => [
    ((x - minX) / (maxX - minX)) * (size * 0.9) + size * 0.05, // margin
    ((y - minY) / (maxY - minY)) * (size * 0.9) + size * 0.05
  ]);
}

async function draw(graph, embeddings, nodes, map) {
  const canvas = document.getElementById('graph');
  const ctx = canvas.getContext('2d');

  const size = Math.min(window.innerWidth, window.innerHeight);
  canvas.width = size;
  canvas.height = size;

  // Normalize embeddings once to fit in [0, size]
  const basePoints = normalizeEmbeddings(embeddings, size);

  // Map nodeId -> embedding index
  const nodeIndex = new Map(nodes.map((id, idx) => [Number(id), idx]));

  // --- State for zoom/pan ---
  let scale = 1;
  let offsetX = 0, offsetY = 0;
  let isDragging = false;
  let lastX = 0, lastY = 0;

  function render() {
    ctx.clearRect(0, 0, size, size);

    // apply transform
    function transform([x, y]) {
      return [
        (x + offsetX - size / 2) * scale + size / 2,
        (y + offsetY - size / 2) * scale + size / 2
      ];
    }

    // --- Draw edges ---
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 0.5;
    for (const [src, neighbors] of graph.entries()) {
      const srcIdx = nodeIndex.get(src);
      if (srcIdx === undefined) continue;
      const srcPoint = basePoints[srcIdx];
      if (!srcPoint) continue;
      const [x1, y1] = transform(srcPoint);

      for (const [tgt] of neighbors.entries()) {
        const tgtIdx = nodeIndex.get(tgt);
        if (tgtIdx === undefined) continue;
        const tgtPoint = basePoints[tgtIdx];
        if (!tgtPoint) continue;
        const [x2, y2] = transform(tgtPoint);

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
    }

    // --- Draw nodes ---
    ctx.fillStyle = 'white';
    ctx.font = `8px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';

    for (const [idx, p] of basePoints.entries()) {
      const [x, y] = transform(p);

      // Draw node circle
      ctx.beginPath();
      ctx.arc(x, y, 2, 0, Math.PI * 2);
      ctx.fill();

      // Draw node label
      const nodeId = Number(nodes[idx]);
      const nodeData = map[nodeId];
      if (nodeData?.name) {
        ctx.fillText(nodeData.name, x, y - 4); // label above node
      }
    }
  }

  // --- Mouse Events ---
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const zoomIntensity = 0.1;
    scale *= e.deltaY < 0 ? (1 + zoomIntensity) : (1 - zoomIntensity);
    scale = Math.max(0.1, scale);
    render();
  });

  canvas.addEventListener('mousedown', (e) => {
    isDragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
  });

  canvas.addEventListener('mouseup', () => {
    isDragging = false;
  });

  canvas.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    offsetX += (e.clientX - lastX) / scale;
    offsetY += (e.clientY - lastY) / scale;
    lastX = e.clientX;
    lastY = e.clientY;
    render();
  });

  // Initial render
  render();
}


function verifyWalks(walks, graph) {
    const allNodes = new Set(Object.keys(graph)); // or graph.keys() if Map
    const seen = new Set();
    for (const walk of walks) {
    for (const id of walk) {
        seen.add(String(id)); // make sure types match
    }
    }

    // check coverage
    const missing = [...allNodes].filter(id => !seen.has(id));

    if (missing.length === 0) {
    console.log("✅ All nodes are covered in the walks");
    } else {
    console.log("❌ Missing nodes:", missing);
    }
}

function computeNormalizedLaplacian(mat) {
  const n = mat.length;
  const L = Array.from({length: n}, () => Array(n).fill(0));

  // compute D^-1/2
  const D_invSqrt = mat.map(row => 0); // placeholder
  for (let i = 0; i < n; i++) {
    const deg = mat[i].reduce((a,b)=>a+b, 0);
    D_invSqrt[i] = deg > 0 ? 1 / Math.sqrt(deg) : 0;
  }

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) L[i][j] = 1; // start with identity
      L[i][j] -= D_invSqrt[i] * mat[i][j] * D_invSqrt[j];
    }
  }
  return L;
}


import SVD from './node2vec/svd.js';
function getSVD(matrix) {
    // run SVD (matrix is m x n; here m == n == nodes.length)
    console.log("starting svd");

    // Call the SVD function with desired options
    // Set withu = true (we want U), withv = false (we don't need V)
    const res = SVD(matrix, true, false); // eps and tol are optional, defaults can be used
    console.log("svd result:", res);

    // Extract U and singular values q
    const { u, q } = res;
    return { u, q };
}
//import { exactGraphDiameter } from './graph_stats/diameter.js';
import { generateWalksForAllNodes, buildCooccurrence, toMatrix } from './node2vec/randomWalk.js';

async function main(map) {
    console.log("starting")
    const graph = await buildGraph(map);
    //console.log("map:", map)
    //console.log("graph", graph)

    /*const { diameter, effectiveDiameter } = exactGraphDiameter(graph);
    console.log("Exact Diameter:", diameter);
    console.log("Exact 90% Effective Diameter:", effectiveDiameter);*/

    // generate walks as before
    const walks = generateWalksForAllNodes(graph, 10, 15); // 10 walks per node, length 15
    console.log("walks created and veri", walks)
    verifyWalks(walks, graph)

    const cooccurMap = buildCooccurrence(walks, 2);
    console.log("cooccur map:", cooccurMap)

    const nodes = Object.keys(map);
    console.log("nodes:", nodes)

    const matrix = toMatrix(cooccurMap, nodes)
    console.log("matrix:", matrix)

    const L = computeNormalizedLaplacian(matrix);
    const matrixSVD = getSVD(L);
    console.log("matrixSVD:", matrixSVD)

    const { u } = matrixSVD;
    const embeddings2D = u.map(row => [row[1], row[2]]);
    console.log("embeddings: ", embeddings2D)
    await draw(graph, embeddings2D, nodes, map)
}

(async () => {
    const URL = '/api/anime2/data';
    async function getParsed() {
        const resp = await fetch(URL);
        if (!resp.ok) throw new Error("HTTP " + resp.status);
        const ab = await resp.arrayBuffer();
        const bin = new Uint8Array(ab);

        const text = pako.ungzip(bin, { to: "string" });
        const map = JSON.parse(text);
        return map
    }
    

    function topKMap(map, K) {
        // Convert map to array of [nodeId, nodeData] pairs
        const entries = Object.entries(map);

        // Compute a "score" for each node — here I'm summing weights in recoms
        const scored = entries.map(([nodeId, node]) => {
            const score = node.recoms.reduce((sum, r) => sum + r.v, 0);
            return [nodeId, node, score];
        });

        // Sort by score descending and take top K
        scored.sort((a, b) => b[2] - a[2]);
        const topK = scored.slice(0, K);

        // Build new map
        const newMap = {};
        for (const [nodeId, node] of topK) {
            newMap[nodeId] = node;
        }

        return newMap;
    }



        const map = await getParsed();
    main(topKMap(map, 1000))
})();