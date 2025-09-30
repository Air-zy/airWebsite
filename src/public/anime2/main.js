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

async function draw(graph, embeddings, nodes, map) {
    const canvas = document.getElementById('graph');
    const ctx = canvas.getContext('2d');
  
    const size = Math.min(window.innerWidth, window.innerHeight);
    canvas.width = size;
    canvas.height = size;
  
    // normd embeddings once to fit in [0, size]
    const basePoints = normalizeEmbeddings(embeddings, size);
  
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

  canvas.addEventListener('click', (e) => {
    const radius = 4
    let clickedNode = null;

    for (const [idx, p] of basePoints.entries()) {
        const [x, y] = transform(p); // screen coordinates after pan/zoom
        const dx = e.offsetX - x;
        const dy = e.offsetY - y;
        if (dx*dx + dy*dy <= radius*radius) {
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

async function main(map) {
    console.log("starting")
    const graph = await buildGraph(map);
    console.log("map:", map)
    /*const { u } = SVD_EMBEDDINGS;
    const embeddings2D = u.map(row => [row[1], row[2]]);
    console.log("embeddings: ", embeddings2D)
    await draw(graph, embeddings2D, nodes, map)*/
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
