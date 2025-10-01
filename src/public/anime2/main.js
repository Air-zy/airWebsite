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
    // Project to 2D: take first two dimensions
    const points2D = embeddings.map(vec => [vec[0] || 0, vec[1] || 0]);

    // Find min/max per axis
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;

    for (const [x, y] of points2D) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
    }

    // Scale to [0, size]
    const scaledPoints = points2D.map(([x, y]) => [
        ((x - minX) / (maxX - minX || 1)) * size,
        ((y - minY) / (maxY - minY || 1)) * size
    ]);

    return scaledPoints;
}

function hsvToRgb(h, s, v) {
    let c = v * s;
    let x = c * (1 - Math.abs((h / 60) % 2 - 1));
    let m = v - c;
    let r = 0, g = 0, b = 0;

    if (0 <= h && h < 60) [r, g, b] = [c, x, 0];
    else if (60 <= h && h < 120) [r, g, b] = [x, c, 0];
    else if (120 <= h && h < 180) [r, g, b] = [0, c, x];
    else if (180 <= h && h < 240) [r, g, b] = [0, x, c];
    else if (240 <= h && h < 300) [r, g, b] = [x, 0, c];
    else if (300 <= h && h < 360) [r, g, b] = [c, 0, x];

    r = Math.round((r + m) * 255);
    g = Math.round((g + m) * 255);
    b = Math.round((b + m) * 255);

    return `rgb(${r},${g},${b})`;
}

//async function draw(graph, embeddings, nodes, map) {
async function draw(graph, nodes, map) {
    const canvas = document.getElementById('graph');
    const ctx = canvas.getContext('2d');

    const size = Math.min(window.innerWidth, window.innerHeight);
    canvas.width = size;
    canvas.height = size;

    const qValues = nodes.map(id => map[id]?.embd?.u[2] ?? 0);
    const minVal = Math.min(...qValues);
    const maxVal = Math.max(...qValues);
    function normalizeQ(nodeId) {
      const val = map[nodeId]?.embd?.u[2] ?? 0;
      return (val - minVal) / (maxVal - minVal);
  }


    // Extract embeddings from map and normalize
    /*const basePoints = normalizeEmbeddings(
        nodes.map(id => Object.values(map[id]?.embd?.u) || [0, 0]), 
        size
    );*/

    const basePoints = normalizeEmbeddings(
        nodes.map(id => {
            const emb = map[id]?.embd;
            if (!emb) return [0, 0];
            return Object.values(emb.u).map(x => x * emb.q);
        }),
        size
    );



    // nodeId -> embedding index
    const nodeIndex = new Map(nodes.map((id, idx) => [Number(id), idx]));

    let scale = 1;
    let offsetX = 0, offsetY = 0;
    let isDragging = false;
    let lastX = 0, lastY = 0;

    function transform([x, y]) {
        return [
            (x + offsetX - size / 2) * scale + size / 2,
            (y + offsetY - size / 2) * scale + size / 2
        ];
    }

    function render() {
      ctx.clearRect(0, 0, size, size);
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
          // Compute node color from q
          const nodeId = Number(nodes[idx]);
          const hue = normalizeQ(nodeId) * 360;
          ctx.fillStyle = hsvToRgb(hue, 0.6, 1);
          // Draw node circle
          ctx.beginPath();
          ctx.arc(x, y, 2, 0, Math.PI * 2);
          ctx.fill();

          const nodeData = map[nodeId];
          if (nodeData?.name) {
              ctx.fillStyle = 'white';
              ctx.fillText(nodeData.name, x, y - 4);
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

    canvas.addEventListener('click', (e) => {
        const radius = 4;
        let clickedNode = null;

        for (const [idx, p] of basePoints.entries()) {
            const [x, y] = transform(p);
            const dx = e.offsetX - x;
            const dy = e.offsetY - y;
            if (dx * dx + dy * dy <= radius * radius) {
                clickedNode = Number(nodes[idx]);
                break;
            }
        }

        if (clickedNode != null) {
            showPopup(map[clickedNode], e.clientX, e.clientY);
        }
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

import { pca3D } from './pca.js';
async function main(map) {
    console.log("starting")
    const graph = await buildGraph(map);
    console.log("map:", map)

    const nodes = Object.keys(map).map(k => Number(k));

    /*
    const embeddingsArray = nodes.map(id => {
        const emb = map[id]?.embd;
        if (!emb) return null;
        return Object.values(emb.u).map(x => x);// * emb.q); //
    }).filter(e => e !== null);

    const reduced2D = pca3D(embeddingsArray);
    console.log("reduced2D", reduced2D); // Array of [x, y] coordinates

    let reducedIndex = 0;
    nodes.forEach(id => {
        if (!map[id]?.embd) return; // skip missing
        // Replace embd with reduced 2D coordinates
        map[id].embd = {
            u: {
                0: reduced2D[reducedIndex][0],
                1: reduced2D[reducedIndex][1],
                2: reduced2D[reducedIndex][2]
            },
            q: 1 // optional, we can set q=1 because it's already scaled
        };
        reducedIndex++;
    });
    */

    console.log("drawing")
    await draw(graph, nodes, map)
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
    
    const map = await getParsed();
    main(map)
})();

const canvas = document.getElementById('graph');
const popup = document.createElement('div');
popup.style.position = 'fixed';
popup.style.background = 'white';
popup.style.fontSize = '10px';
popup.style.border = '1px solid black';
popup.style.padding = '8px';
popup.style.zIndex = 1000;
popup.style.display = 'none';
popup.style.maxWidth = '300px';
popup.style.whiteSpace = 'pre-wrap';
document.body.appendChild(popup);

function showPopup(data, screenX, screenY) {
    console.log("SHOW POPUP!!")
    popup.textContent = JSON.stringify(data, null, 2); // pretty-print JSON
    popup.style.left = screenX + 'px';
    popup.style.top = screenY + 'px';
    popup.style.display = 'block';
}

// hide popup on click elsewhere
document.addEventListener('click', (e) => {
  if (e.target !== canvas) {
    popup.style.display = 'none';
  }
});
