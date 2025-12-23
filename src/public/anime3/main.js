
function restore(value) {
    if (!value) return value;
    if (value.__type === 'Map') return new Map(value.value.map(function (pair) { return [pair[0], restore(pair[1])]; }));
    if (value.__type === 'Set') return new Set(value.value.map(restore));
    if (Array.isArray(value)) return value.map(restore);
    if (typeof value === 'object') { var out = {}; Object.keys(value).forEach(function (k) { out[k] = restore(value[k]); }); return out; }
    return value;
}

var resultsEl = document.getElementById('results');
var searchEl = document.getElementById('search');
var selectedBar = document.getElementById('selectedBar');
var recsPanel = document.getElementById('recommendations');
var recsEl = document.getElementById('recs');
var clearBtn = document.getElementById('clearBtn');

var nodesMap = new Map();
var edgesMap = new Map();
var nodesArr = [];
var selectedSet = new Set();

function getNodeImg(node) {
    if (!node) return '';
    return node.img || (node.value && node.value.img) || node.image || node.banner || '';
}

function jsEscape(s) {
    if (!s && s !== 0) return '';
    return String(s).replace(/"/g, '\\"').replace(/\n/g, ' ');
}

async function loadCoords() {
    var res = await fetch('/api/anime3/coords?v=2');
    if (!res.ok) throw new Error('fetch failed: ' + res.status);
    var json = await res.json();
    var b64 = json.data || '';

    function b64toU8(s) {
        var binary = atob(s);
        var arr = new Uint8Array(binary.length);
        for (var i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i);
        return arr;
    }

    console.log("decompressing coords...")
    var decompressed = pako.inflate(b64toU8(b64), { to: 'string' });
    var parsed = JSON.parse(decompressed);

    //

    const size = 800;

    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    canvas.style.display = "block";
    canvas.style.margin = "20px auto";
    canvas.style.border = "1px solid #444";
    canvas.style.background = "#000000ff";
    document.body.appendChild(canvas);

    const ctx = canvas.getContext("2d");

    // === camera state ===
    let scale = 1;
    let offsetX = 0;
    let offsetY = 0;
    let isDragging = false;
    let lastX = 0;
    let lastY = 0;

    // === helpers ===
    function worldToScreen(x, y) {
        return {
            x: (x * size) * scale + offsetX,
            y: (y * size) * scale + offsetY
        };
    }

    const GENRE_COLORS = {
        Comedy: [255, 235, 59],  // yellow
        Sports: [0, 180, 255],    // electric blue
        Action: [255, 165, 0],    // orange
        Drama: [156, 39, 176],  // purple
        Mystery: [33, 150, 243],  // deep blue
        Psychological: [106, 92, 195],  // blue purple
        Romance: [255, 105, 180],  // pink
        Ecchi: [255, 105, 180],  // pink
        Supernatural: [0, 188, 212],  // cyan
        "Sci-Fi": [135, 155, 255],  // light eltric blue
        "Slice of Life": [139, 195, 74], // soft green
        Horror: [78, 19, 122],  // dark violet
        Fantasy: [149, 117, 205],  // lavender purple
        Adventure: [2, 182, 14],  // forest green
        Hentai: [255, 20, 147],   // hot pink
        Music: [0, 229, 255],    // electric cyan
    };
    const GENRE_WEIGHTS = {
        Action: 0.3,
        Comedy: 0.6,
        Drama: 0.9,
        Romance: 0.8,
        Sports: 0.9,
        Mystery: 1.2,
        Psychological: 1.2,
        Supernatural: 0.8,
        Ecchi: 0.7,
        "Sci-Fi": 0.4,
        "Slice of Life": 1.0,
        Horror: 1.4,
        Fantasy: 0.2,
        Adventure: 0.2,
        Hentai: 0.7,
        Music: 0.6
    };

    function blendGenres(genres) {
        if (!genres || genres.length === 0) return "rgb(180,180,180)";

        let r = 0, g = 0, b = 0;
        let wsum = 0;

        for (const genre of genres) {
            const c = GENRE_COLORS[genre];
            if (!c) continue;

            const w = GENRE_WEIGHTS[genre] ?? 1;

            r += c[0] * w;
            g += c[1] * w;
            b += c[2] * w;
            wsum += w;
        }

        if (wsum === 0) return "rgb(180,180,180)";

        r = Math.round(r / wsum);
        g = Math.round(g / wsum);
        b = Math.round(b / wsum);

        return `rgb(${r},${g},${b})`;
    }


    const adj = buildAdjacency();
    function degreePopularity(id) {
        const neighbors = adj.get(id);
        return neighbors ? neighbors.length : 0;
    }

    function getNeighborsWithinDistance(startId, maxDistance) {
        const result = new Set();
        const visited = new Set([startId]);
        const queue = [{ id: startId, dist: 0 }];

        while (queue.length > 0) {
            const { id, dist } = queue.shift();

            if (dist === maxDistance) continue;

            const neighbors = adj.get(id) ?? [];
            for (const neighbor of neighbors) { // maybe trim only top 10 or so...
                const nId = neighbor.to
                if (!visited.has(nId)) {
                    visited.add(nId);
                    result.add(nId);
                    queue.push({ id: nId, dist: dist + 1 });
                }
            }
        }

        return Array.from(result);
    }

    // --- PRECOMPUTE edges once ---
    const preEdges = []; // array of { paX, paY, pbX, pbY, width }

    edgesMap.forEach((v, k) => {
        if (!k) return;
        const parts = String(k).split(',');
        if (parts.length < 2) return;
        const a = parts[0].trim();
        const b = parts[1].trim();

        const na = parsed[a];
        const nb = parsed[b];
        if (!na || !nb) return;

        const rawWeight = Number(v) || 0;
        const width = Math.min(rawWeight ** 0.3 / 10, 1);
        if (!(width > 0)) return;

        const node = nodesMap.get(a)
        const genres = node?.genre;
        const fillStyleCol = blendGenres(genres)

        preEdges.push({
            idA: a,
            idB: b,
            col: fillStyleCol,
            paX: na.x * size,
            paY: na.y * size,
            pbX: nb.x * size,
            pbY: nb.y * size,
            width
        });
    });

    // precompute
    const nodesSorted = Object.entries(parsed)
        .map(([id, v]) => {
            const popularity = degreePopularity(id);

            const node = nodesMap.get(id)

            const genres = node?.genre;
            const color = blendGenres(genres)

            const r = popularity ** 0.4
            const text = node?.title || id

            const x = v.x
            const y = v.y
            return { id, x, y, color, r, text };
        })
        .sort((a, b) => b.popularity - a.popularity);

    //console.log(nodesSorted)
    //console.log(preEdges.length)

    let focusedNode = null;
    let focusedNodes = null;
    function draw() {
        ctx.clearRect(0, 0, size, size);

        //

        ctx.lineCap = 'round';
        ctx.strokeStyle = 'rgb(255,255,255)';

        let count = 0;
        for (let i = 0; i < preEdges.length; i++) {
            const e = preEdges[i];
            const idA = e.idA;
            const idB = e.idB;

            if (focusedNode != null && !(focusedNodes.has(idA) && focusedNodes.has(idB)) && !(idA == focusedNode) && !(idB == focusedNode)) {
                continue;
            }

            const pax = e.paX * scale + offsetX;
            const pay = e.paY * scale + offsetY;
            const pbx = e.pbX * scale + offsetX;
            const pby = e.pbY * scale + offsetY;

            // skip offscreen
            if (
                (pax < -20 && pbx < -20) ||
                (pay < -20 && pby < -20) ||
                (pax > size + 20 && pbx > size + 20) ||
                (pay > size + 20 && pby > size + 20)
            ) continue;

            count++;
            if (count > 4000) {
                break;
            }

            ctx.strokeStyle = e.col;
            ctx.lineWidth = e.width;
            ctx.beginPath();
            ctx.moveTo(pax, pay);
            ctx.lineTo(pbx, pby);
            ctx.stroke();
        }

        //


        ctx.fillStyle = "#00ffff"; // whatever you want for default
        ctx.font = "10px monospace";

        const minLabelDist = 60;                // >= this many px between label anchor points
        const cellSize = minLabelDist;          // spatial-hash cell size
        const labelGrid = new Map();            // map "bx,by" -> array of [x,y] label anchors
        const minLabelDistSq = minLabelDist * minLabelDist;

        function _gridKey(x, y) { return ((x & 0xffff) << 16) | (y & 0xffff); }

        // returns true and stores the label anchor if there's no neighbor within minLabelDist
        function canPlaceLabelAt(px, py) {
            const bx = Math.floor(px / cellSize);
            const by = Math.floor(py / cellSize);

            // check 3x3 neighboring cells
            for (let nx = bx - 1; nx <= bx + 1; nx++) {
                for (let ny = by - 1; ny <= by + 1; ny++) {
                    const key = _gridKey(nx, ny);
                    const arr = labelGrid.get(key);
                    if (!arr) continue;
                    for (let i = 0; i < arr.length; i++) {
                        const [lx, ly] = arr[i];
                        const dx = lx - px;
                        const dy = ly - py;
                        if (dx * dx + dy * dy < minLabelDistSq) return false;
                    }
                }
            }

            // reserve this cell
            const key = _gridKey(bx, by);
            if (!labelGrid.has(key)) labelGrid.set(key, []);
            labelGrid.get(key).push([px, py]);
            return true;
        }

        for (const { id, x, y, color, r, text } of nodesSorted) {
            if (focusedNode != null && !focusedNodes.has(id) && id != focusedNode) {
                continue;
            }
            const p = worldToScreen(x, y);

            // skip if offscreen
            if (p.x < -10 || p.y < -10 || p.x > size + 10 || p.y > size + 10) continue;

            ctx.fillStyle = color;

            const cx = p.x
            const cy = p.y

            const isFocused = id === focusedNode;
            const drawR = isFocused ? r * 2 : r;

            // Draw white outline FIRST (behind)
            if (isFocused) {
                ctx.save();
                ctx.beginPath();
                ctx.arc(cx, cy, drawR + 4, 0, Math.PI * 2);
                ctx.strokeStyle = "#ffffff";
                ctx.lineWidth = 1;
                ctx.stroke();
                ctx.restore();
            }

            // Draw the circle on top
            ctx.beginPath();
            ctx.arc(cx, cy, drawR, 0, Math.PI * 2);
            ctx.fill();


            // padding above circle
            const padding = isFocused ? 10 : 4;

            const labelX = Math.round(cx);
            const labelY = Math.round(cy - r - padding);

            ctx.textAlign = "center";
            ctx.textBaseline = "bottom";

            if (canPlaceLabelAt(labelX, labelY)) {
                ctx.fillStyle = color;
                ctx.fillText(text, labelX, labelY);
            }
        }
    }


    // === zoom ===
    canvas.addEventListener("wheel", e => {
        e.preventDefault();

        const zoom = e.deltaY < 0 ? 1.1 : 0.9;

        const mx = e.offsetX;
        const my = e.offsetY;

        // zoom around mouse
        offsetX = mx - (mx - offsetX) * zoom;
        offsetY = my - (my - offsetY) * zoom;
        scale *= zoom;

        draw();
    }, { passive: false });

    // === pan ===
    canvas.addEventListener("mousedown", e => {
        isDragging = true;
        lastX = e.clientX;
        lastY = e.clientY;
    });

    window.addEventListener("mousemove", e => {
        if (!isDragging) return;
        offsetX += e.clientX - lastX;
        offsetY += e.clientY - lastY;
        lastX = e.clientX;
        lastY = e.clientY;
        draw();
    });

    window.addEventListener("mouseup", () => {
        isDragging = false;
    });

    // === initial draw ===
    draw();

    //

    /* --- SEARCH UI: paste this after `const ctx = canvas.getContext("2d");` --- */

    //// helper: build nodesArr from parsed + nodesMap if not already present
    let nodesArr = window.nodesArr; // respect a preexisting global if present
    if (!Array.isArray(nodesArr)) {
        nodesArr = Object.entries(parsed).map(([id, v]) => {
            const node = nodesMap.get(id) || {};
            return {
                id,
                title: node.title || node.name || id,
                x: v.x,
                y: v.y,
                genres: node.genre || [],
                rawNode: node
            };
        });
    }

    //// create search UI
    const searchWrapper = document.createElement('div');
    searchWrapper.style.width = size + 'px';
    searchWrapper.style.margin = '8px auto';
    searchWrapper.style.textAlign = 'left';
    searchWrapper.style.fontFamily = 'monospace';

    searchWrapper.innerHTML = `
  <div style="display:flex;gap:8px;">
    <input id="node-search-input" placeholder="Search node id or title..." style="flex:1;padding:6px;font-size:13px;border:1px solid #444;background:#111;color:#fff" />
    <button id="node-search-clear" title="Clear" style="padding:6px;font-size:13px">✕</button>
  </div>
  <div id="node-search-results" style="max-height:180px;overflow:auto;margin-top:6px;border:1px solid #333;background:#070707;padding:6px"></div>
`;
    document.body.insertBefore(searchWrapper, canvas); // insert above canvas

    const input = searchWrapper.querySelector('#node-search-input');
    const clearBtn = searchWrapper.querySelector('#node-search-clear');
    const resultsDiv = searchWrapper.querySelector('#node-search-results');

    function renderResults(results) {
        resultsDiv.innerHTML = '';
        if (!results || results.length === 0) {
            resultsDiv.innerHTML = `<div style="padding:6px;color:#888">no results</div>`;
            return;
        }
        const ul = document.createElement('div');
        ul.style.display = 'flex';
        ul.style.flexDirection = 'column';
        ul.style.gap = '4px';

        results.forEach(n => {
            const el = document.createElement('button');
            el.type = 'button';
            el.style.textAlign = 'left';
            el.style.padding = '6px';
            el.style.border = '1px solid #222';
            el.style.background = '#000';
            el.style.color = '#eee';
            el.style.cursor = 'pointer';
            el.style.fontSize = '13px';
            el.style.whiteSpace = 'nowrap';
            el.style.overflow = 'hidden';
            el.style.textOverflow = 'ellipsis';
            el.textContent = (n.title || n.id);
            el.title = (n.title || n.id);
            el.addEventListener('click', () => {
                focusOnNode(n);
            });
            ul.appendChild(el);
        });
        resultsDiv.appendChild(ul);
    }

    function doSearch(q) {
        q = (q || '').toLowerCase().trim();
        if (!q) { renderResults(nodesArr.slice(0, 100)); return; }
        const results = nodesArr.filter(function (n) {
            var t = (n.title || '').toLowerCase();
            var i = (n.id || '').toLowerCase();
            return t.includes(q) || i.includes(q);
        }).slice(0, 200);
        renderResults(results);
    }

    input.addEventListener('input', (e) => doSearch(e.target.value));
    clearBtn.addEventListener('click', () => {
        input.value = '';
        doSearch('');
        input.focus();
            
        focusedNode = null;
        draw();
    });

    function focusOnNode(node) {
        const coords = parsed[node.id];
        if (!coords) {
            console.warn('no coords for node', node.id);
            return;
        }

        focusedNode = node.id
        focusedNodes = new Set(getNeighborsWithinDistance(node.id, 1));

        const targetScale = 30;

        // compute target offsets so the node lands centered in canvas
        const nodeWorldX = coords.x * size;
        const nodeWorldY = coords.y * size;
        const targetOffsetX = (size / 2) - (nodeWorldX * targetScale);
        const targetOffsetY = (size / 2) - (nodeWorldY * targetScale);

        // animate from current scale/offset to target with easing
        animatePanZoom(scale, offsetX, offsetY, targetScale, targetOffsetX, targetOffsetY);
    }

    let panAnim = null;
    function animatePanZoom(startScale, startOffX, startOffY, endScale, endOffX, endOffY) {
        if (panAnim) cancelAnimationFrame(panAnim.id);
        const duration = 400; // ms
        const start = performance.now();
        function step(now) {
            const t = Math.min(1, (now - start) / duration);
            // easeInOutQuad
            const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
            scale = startScale + (endScale - startScale) * ease;
            offsetX = startOffX + (endOffX - startOffX) * ease;
            offsetY = startOffY + (endOffY - startOffY) * ease;
            draw();
            if (t < 1) {
                panAnim.id = requestAnimationFrame(step);
            } else {
                panAnim = null;
            }
        }
        panAnim = { id: requestAnimationFrame(step) };
    }

    /* --- END SEARCH UI --- */


}

// Load compressed graph data from server, decompress and restore
async function load() {
    try {
        var res = await fetch('/api/anime3/data');
        if (!res.ok) throw new Error('fetch failed: ' + res.status);
        var json = await res.json();
        var b64 = json.data || '';

        function b64toU8(s) {
            var binary = atob(s);
            var arr = new Uint8Array(binary.length);
            for (var i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i);
            return arr;
        }

        var decompressed = pako.inflate(b64toU8(b64), { to: 'string' });
        var parsed = JSON.parse(decompressed);

        nodesMap = restore(parsed.nodes);
        edgesMap = restore(parsed.edges);

        console.log(nodesMap)

        nodesArr = Array.from(nodesMap.values()).map(function (n) {
            var id = String(n.id || n.key || '');
            var title = String(n.title || n.name || '');
            if (!nodesMap.has(id)) nodesMap.set(id, Object.assign({}, n, { id: id }));
            return { id: id, title: title };
        }).sort(function (a, b) { return a.title.localeCompare(b.title); });

        renderResults(nodesArr.slice(0, 100));
        await loadCoords();
    } catch (err) {
        console.warn(err)
        resultsEl.textContent = 'Error: ' + err.message;
    }
}

function renderResults(list) {
    resultsEl.innerHTML = '';
    if (!list.length) { resultsEl.innerHTML = '<div style="color:#888">no results</div>'; return; }

    list.forEach(function (it) {
        var wrapper = document.createElement('div');
        wrapper.className = 'item';
        wrapper.dataset.id = it.id;

        var node = nodesMap.get(it.id) || {};
        var genres = (node.value && node.value.genre) || [];
        var genreStr = Array.isArray(genres) ? genres.join(', ') : (genres || '');
        var desc = (node.value && node.value.desc) || node.desc || '';

        var imgSrc = getNodeImg(node);
        if (imgSrc) wrapper.style.backgroundImage = 'url("' + jsEscape(imgSrc) + '")';
        else wrapper.classList.add('no-image');

        var overlay = document.createElement('div');
        overlay.className = 'overlay';

        var content = document.createElement('div');
        content.className = 'item-content';

        var titleDiv = document.createElement('div');
        titleDiv.className = 'item-title';
        titleDiv.textContent = it.title || '(no title)';
        content.appendChild(titleDiv);

        if (genreStr) {
            var g = document.createElement('div'); g.className = 'item-sub'; g.textContent = genreStr; content.appendChild(g);
        }

        overlay.appendChild(content);
        wrapper.appendChild(overlay);

        wrapper.addEventListener('mouseenter', function (e) { showTooltip(e, desc); });
        wrapper.addEventListener('mousemove', moveTooltip);
        wrapper.addEventListener('mouseleave', hideTooltip);

        wrapper.addEventListener('click', function () { toggleSelect(it.id, wrapper); });
        if (selectedSet.has(String(it.id))) wrapper.classList.add('selected');

        resultsEl.appendChild(wrapper);
    });
}

function toggleSelect(id, el) {
    id = String(id);
    if (selectedSet.has(id)) { selectedSet.delete(id); if (el) el.classList.remove('selected'); }
    else { selectedSet.add(id); if (el) el.classList.add('selected'); }
    updateSelectedBar();
    if (selectedSet.size) runRecommendations(); else recsPanel.style.display = 'none';
}

function updateSelectedBar() {
    selectedBar.innerHTML = '';
    if (selectedSet.size === 0) { selectedBar.innerHTML = '<div style="color:#888">No anime selected - click items to add them.</div>'; return; }

    Array.from(selectedSet).forEach(function (id) {
        var node = nodesMap.get(id) || { title: '(no title)' };
        var title = node.title || node.name || '(no title)';
        var genres = (node.value && node.value.genre) || node.genre || node.genres || [];
        var genreStr = Array.isArray(genres) ? genres.join(', ') : (genres || '');

        var pill = document.createElement('div');
        pill.className = 'sel-pill';

        var imgUrl = getNodeImg(node);
        if (imgUrl) {
            var small = document.createElement('div');
            small.style.width = '72px';
            small.style.height = '40px';
            small.style.borderRadius = '6px';
            small.style.flexShrink = '0';
            small.style.backgroundImage = 'url("' + jsEscape(imgUrl) + '")';
            small.style.backgroundSize = 'cover';
            small.style.backgroundPosition = 'center';
            small.style.boxShadow = 'inset 0 0 0 1000px rgba(0,0,0,0.25)';
            pill.appendChild(small);
        }

        var inner = document.createElement('div');
        inner.style.display = 'flex'; inner.style.flexDirection = 'column'; inner.style.alignItems = 'flex-start'; inner.style.marginRight = '6px'; inner.style.minWidth = 0;

        var titleDiv = document.createElement('div');
        titleDiv.style.fontWeight = '600';
        titleDiv.style.whiteSpace = 'nowrap'; titleDiv.style.overflow = 'hidden'; titleDiv.style.textOverflow = 'ellipsis'; titleDiv.style.maxWidth = '180px';
        titleDiv.textContent = title;
        inner.appendChild(titleDiv);

        var rem = document.createElement('button'); rem.textContent = '✕'; rem.title = 'Remove';
        rem.addEventListener('click', function () {
            selectedSet.delete(id);
            updateSelectedBar();
            var ch = Array.from(resultsEl.children).find(function (c) { return c.dataset && c.dataset.id === id; });
            if (ch) ch.classList.remove('selected');
            if (selectedSet.size) runRecommendations(); else recsPanel.style.display = 'none';
        });

        pill.appendChild(inner);
        pill.appendChild(rem);
        selectedBar.appendChild(pill);
    });
}

// search handling
searchEl.addEventListener('input', function () {
    var q = searchEl.value.trim().toLowerCase();
    if (!q) { renderResults(nodesArr.slice(0, 100)); return; }
    var results = nodesArr.filter(function (n) { var t = (n.title || '').toLowerCase(); var i = (n.id || '').toLowerCase(); return t.includes(q) || i.includes(q); }).slice(0, 200);
    renderResults(results);
});

clearBtn.addEventListener('click', function () {
    searchEl.value = ''; renderResults(nodesArr.slice(0, 100));
});

function buildAdjacency() {
    var adj = new Map();
    function ensure(n) {
        if (!adj.has(n)) adj.set(n, []);
    }

    edgesMap.forEach(function (v, k) {
        if (!k) return; var parts = String(k).split(','); if (parts.length < 2) return;
        var a = String(parts[0].trim());
        var b = String(parts[1].trim());
        var numvotes = Number(v) || 0;

        let weight = 1 / (1 + Math.sqrt(numvotes))
        if (numvotes < 0) {
            weight = 1
        }

        //let raw = numvotes || 0;
        //if (raw < 0) raw /= 100;
        //const sign = Math.sign(raw);
        //const weight = sign * Math.pow(Math.abs(raw), 0.5);

        ensure(a);
        ensure(b);
        adj.get(a).push({ to: b, w: weight });
        adj.get(b).push({ to: a, w: weight });
    });
    return adj;
}


//

function PageRankSumm(adj, sources) {
    const alpha = 0.05;
    const maxIters = 1000;
    const eps = 1e-6;

    console.log("page rank sum")

    const nodes = Array.from(adj.keys());
    //const N = nodes.length;

    let r = new Map();
    let rNew = new Map();
    const s = new Map();

    for (const n of nodes) {
        r.set(n, 0);
        rNew.set(n, 0);
        s.set(n, 0);
    }

    const invSources = 1 / sources.length;
    for (const n of sources) {
        s.set(n, invSources);
    }

    // --- precompute transition probabilities ---
    const P = new Map();

    for (const [v, neighbors] of adj) {
        let total = 0;
        for (const nb of neighbors) {
            total += 1 / nb.w
        }

        if (total > 0) {
            const probs = new Map();
            const invTotal = 1 / total;
            for (const nb of neighbors) {
                probs.set(nb.to, (1 / nb.w) * invTotal);
            }
            P.set(v, probs);
        }
    }

    // --- power iteration ---
    for (let iter = 0; iter < maxIters; iter++) {
        // reset rNew
        for (const v of nodes) {
            rNew.set(v, alpha * s.get(v));
        }

        // propagate mass
        for (const v of nodes) {
            const rv = r.get(v);
            if (rv === 0) continue;

            const probs = P.get(v);
            const mass = (1 - alpha) * rv;
            for (const [u, p] of probs) {
                rNew.set(u, rNew.get(u) + mass * p);
            }
        }

        // convergence check + swap
        let diff = 0;
        for (const v of nodes) {
            const nv = rNew.get(v);
            diff += Math.abs(nv - r.get(v));
            r.set(v, nv);
        }

        if (diff < eps) {
            console.log("converged at iter", iter)
            break;
        }
    }

    // reverse rank
    let max = -Infinity;
    for (const v of r.values()) if (v > max) max = v;

    const reversed = new Map();
    for (const [node, v] of r) {
        reversed.set(node, max - v);
    }

    return reversed;
}

//


function MinHeap() { this.data = []; }
MinHeap.prototype.size = function () { return this.data.length; };
MinHeap.prototype.push = function (x) { this.data.push(x); this._siftUp(this.data.length - 1); };
MinHeap.prototype.pop = function () { if (this.data.length === 0) return undefined; var top = this.data[0]; var last = this.data.pop(); if (this.data.length) { this.data[0] = last; this._siftDown(0); } return top; };
MinHeap.prototype._siftUp = function (i) { var a = this.data; while (i > 0) { var p = (i - 1) >> 1; if (a[p].dist <= a[i].dist) break; var tmp = a[p]; a[p] = a[i]; a[i] = tmp; i = p; } };
MinHeap.prototype._siftDown = function (i) { var a = this.data; var n = a.length; while (true) { var l = 2 * i + 1; var r = l + 1; var smallest = i; if (l < n && a[l].dist < a[smallest].dist) smallest = l; if (r < n && a[r].dist < a[smallest].dist) smallest = r; if (smallest === i) break; var tmp = a[i]; a[i] = a[smallest]; a[smallest] = tmp; i = smallest; } };

function DijkstrasSumm(adj, sources) {
    function degreePopularity(id) {
        const neighbors = adj.get(id);
        return neighbors ? neighbors.length : 0;
    }

    const sourceWeights = sources.map(s => {
        const pop = 1 / degreePopularity(s) ** 0.5;
        return pop
    });

    var k = sources.length;
    var distancesMap = new Map();
    var prev = new Map();
    adj.forEach(function (_, node) {
        distancesMap.set(node, new Float64Array(k).fill(Infinity));
        prev.set(node, new Array(k).fill(null));
    });
    var heap = new MinHeap();

    sources.forEach(function (s, i) {
        if (!adj.has(s)) return;
        distancesMap.get(s)[i] = 0;
        prev.get(s)[i] = null;
        heap.push({
            id: s,
            src: i,
            dist: 0
        });
    });

    while (heap.size()) {
        var u = heap.pop();
        //console.log(u)
        var arr = distancesMap.get(u.id);

        if (!arr || u.dist !== arr[u.src]) continue;

        var neighbors = adj.get(u.id) || [];
        neighbors.forEach(function (nb) {
            let nbWeight = nb.w

            // modern animes stronger!
            const nbNode = nodesMap.get(nb.to);
            const uNode = nodesMap.get(u.id);
            const uYear = uNode.year || 0
            const nbYear = nbNode.year || 0
            const uPopular = degreePopularity(u.id)
            const nbPopular = degreePopularity(nb.to)

            if (nbPopular < uPopular) { // promote less popular anime
                nbWeight *= 0.5
            }
            if (nbYear > uYear) { // promote more recent anime
                //console.log(nbNode.title, uNode.title)
                nbWeight *= 0.8
            }

            const total = u.dist + nbWeight;
            const nbArr = distancesMap.get(nb.to);
            if (total < nbArr[u.src]) {
                nbArr[u.src] = total;
                prev.get(nb.to)[u.src] = u.id;
                heap.push({
                    id: nb.to,
                    src: u.src,
                    dist: total
                });
            }
        });
    }

    var finalDistances = new Map();
    /*distancesMap.forEach(function (arr, node) {
        var sum = 0;
        for (var i = 0; i < k; i++) sum += arr[i]; finalDistances.set(node, sum);
    });
*/
    distancesMap.forEach(function (arr, node) {
        let sum = 0;
        for (let i = 0; i < k; i++) {
            sum += arr[i] * sourceWeights[i];
        }
        finalDistances.set(node, sum);
    });

    return finalDistances;
}

function runRecommendations() {
    if (selectedSet.size === 0) { recsPanel.style.display = 'none'; return; }
    var adj = buildAdjacency();
    var sources = Array.from(selectedSet).filter(function (s) {
        return adj.has(String(s));
    });

    if (!sources.length) {
        recsEl.innerHTML = '<div style="color:#888">None of the selected items exist in the graph; cannot compute recommendations.</div>';
        recsPanel.style.display = 'block';
        return;
    }

    var distances = DijkstrasSumm(adj, sources);
    //var distances = PageRankSumm(adj, sources);
    var candidates = [];
    distances.forEach(function (dist, nodeId) {
        if (selectedSet.has(nodeId)) return; // already in selected...

        //if (!isFinite(dist)) return;
        var node = nodesMap.get(nodeId);
        var label = node.title || node.name || '';;
        candidates.push({ id: nodeId, title: label, distance: dist });
    });

    candidates.sort(function (a, b) {
        return a.distance - b.distance;
    });

    var best = candidates.slice(0, 80);
    var worst = candidates.slice(-4);

    renderRecommendations(best.concat(worst));
}

function renderRecommendations(list) {
    recsEl.innerHTML = '';
    if (!list.length) { recsEl.innerHTML = '<div style="color:#888">No recommendations found.</div>'; recsPanel.style.display = 'block'; return; }

    list.forEach(function (it) {
        var node = nodesMap.get(it.id) || {};
        var genres = (node.value && node.value.genre) || node.genre || node.genres || [];
        var genreStr = Array.isArray(genres) ? genres.join(', ') : (genres || '');
        var desc = (node.value && node.value.desc) || node.desc || '';

        var el = document.createElement('div');
        el.className = 'rec-item';
        var img = getNodeImg(node);
        if (img) el.style.backgroundImage = 'url("' + jsEscape(img) + '")'; else el.classList.add('no-image');

        var overlay = document.createElement('div'); overlay.className = 'rec-overlay';
        var left = document.createElement('div'); left.style.display = 'flex'; left.style.flexDirection = 'column'; left.style.gap = '4px'; left.style.minWidth = 0;
        var t = document.createElement('div'); t.style.fontWeight = '600'; t.style.whiteSpace = 'nowrap'; t.style.overflow = 'hidden'; t.style.textOverflow = 'ellipsis'; t.textContent = it.title || '(no title)'; left.appendChild(t);
        if (genreStr) {
            var g = document.createElement('div');
            g.className = 'item-sub';
            g.textContent = genreStr;
            left.appendChild(g);
        }

        var scaledScore = (1 / it.distance) * selectedSet.size;
        var scoreStr = isFinite(scaledScore) ? scaledScore.toFixed(4) : '0.0000';
        var right = document.createElement('div');
        right.className = 'badge';
        right.textContent = scoreStr + " (" + node.year + ")";

        overlay.appendChild(left); overlay.appendChild(right); el.appendChild(overlay);

        el.addEventListener('mouseenter', function (e) { showTooltip(e, desc); });
        el.addEventListener('mousemove', moveTooltip);
        el.addEventListener('mouseleave', hideTooltip);

        left.addEventListener('click', function (e) {
            e.stopPropagation();
        });
        el.addEventListener('click', function () {
            selectedSet.add(it.id);
            updateSelectedBar();
            var ch = Array.from(resultsEl.children).find(function (c) {
                return c.dataset && c.dataset.id === it.id;
            });
            if (ch) ch.classList.add('selected');
            runRecommendations();
        });

        recsEl.appendChild(el);
    });

    recsPanel.style.display = 'block';
}

var tooltip = document.getElementById('tooltip');
function showTooltip(e, html) {
    if (!html) return;
    tooltip.innerHTML = html;
    tooltip.style.display = 'block';
    moveTooltip(e);
}
function moveTooltip(e) {
    tooltip.style.left = (e.clientX + 16) + 'px';
    tooltip.style.top = (e.clientY + 16) + 'px';
}
function hideTooltip() {
    tooltip.style.display = 'none';
}

updateSelectedBar();
load();