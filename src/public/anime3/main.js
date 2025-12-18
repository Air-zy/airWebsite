
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

        nodesArr = Array.from(nodesMap.values()).map(function (n) {
            var id = String(n.id || n.key || '');
            var title = String(n.title || n.name || '');
            if (!nodesMap.has(id)) nodesMap.set(id, Object.assign({}, n, { id: id }));
            return { id: id, title: title };
        }).sort(function (a, b) { return a.title.localeCompare(b.title); });

        renderResults(nodesArr.slice(0, 100));
    } catch (err) {
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
        var genres = (node.value && node.value.genre) || node.genre || node.genres || [];
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
    if (selectedSet.size === 0) { selectedBar.innerHTML = '<div style="color:#888">No anime selected — click items to add them.</div>'; return; }

    Array.from(selectedSet).forEach(function (id) {
        var node = nodesMap.get(id) || { title: '(no title)' };
        var title = node.title || node.name || '(no title)';
        var genres = (node.value && node.value.genre) || node.genre || node.genres || [];
        var genreStr = Array.isArray(genres) ? genres.join(', ') : (genres || '');

        var pill = document.createElement('div');
        pill.className = 'sel-pill';

        // small background thumbnail inside pill to keep the banner feel
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

        if (genreStr) {
            var g = document.createElement('div'); g.className = 'pill-genres'; g.textContent = genreStr; inner.appendChild(g);
        }

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

clearBtn.addEventListener('click', function () { searchEl.value = ''; renderResults(nodesArr.slice(0, 100)); });

function buildAdjacency() {
    var adj = new Map(); function ensure(n) { if (!adj.has(n)) adj.set(n, []); }
    edgesMap.forEach(function (v, k) {
        if (!k) return; var parts = String(k).split(','); if (parts.length < 2) return;
        var a = String(parts[0].trim()); var b = String(parts[1].trim()); var numvotes = Number(v) || 0; var weight = 1 / (1 + Math.sqrt(numvotes)); ensure(a); ensure(b); adj.get(a).push({ to: b, w: weight }); adj.get(b).push({ to: a, w: weight });
    });
    return adj;
}

function MinHeap() { this.data = []; }
MinHeap.prototype.size = function () { return this.data.length; };
MinHeap.prototype.push = function (x) { this.data.push(x); this._siftUp(this.data.length - 1); };
MinHeap.prototype.pop = function () { if (this.data.length === 0) return undefined; var top = this.data[0]; var last = this.data.pop(); if (this.data.length) { this.data[0] = last; this._siftDown(0); } return top; };
MinHeap.prototype._siftUp = function (i) { var a = this.data; while (i > 0) { var p = (i - 1) >> 1; if (a[p].dist <= a[i].dist) break; var tmp = a[p]; a[p] = a[i]; a[i] = tmp; i = p; } };
MinHeap.prototype._siftDown = function (i) { var a = this.data; var n = a.length; while (true) { var l = 2 * i + 1; var r = l + 1; var smallest = i; if (l < n && a[l].dist < a[smallest].dist) smallest = l; if (r < n && a[r].dist < a[smallest].dist) smallest = r; if (smallest === i) break; var tmp = a[i]; a[i] = a[smallest]; a[smallest] = tmp; i = smallest; } };

function computeDistancesMultiSource(adj, sources) {
    var k = sources.length; var distancesMap = new Map(); var prev = new Map(); adj.forEach(function (_, node) { distancesMap.set(node, new Float64Array(k).fill(Infinity)); prev.set(node, new Array(k).fill(null)); }); var heap = new MinHeap(); sources.forEach(function (s, i) { if (!adj.has(s)) return; distancesMap.get(s)[i] = 0; prev.get(s)[i] = null; heap.push({ id: s, src: i, dist: 0 }); }); while (heap.size()) { var u = heap.pop(); var arr = distancesMap.get(u.id); if (!arr || u.dist !== arr[u.src]) continue; var neighbors = adj.get(u.id) || []; neighbors.forEach(function (nb) { var total = u.dist + nb.w; var nbArr = distancesMap.get(nb.to); if (total < nbArr[u.src]) { nbArr[u.src] = total; prev.get(nb.to)[u.src] = u.id; heap.push({ id: nb.to, src: u.src, dist: total }); } }); } var finalDistances = new Map(); distancesMap.forEach(function (arr, node) { var sum = 0; for (var i = 0; i < k; i++) sum += arr[i]; finalDistances.set(node, sum); }); return { distancesMap: finalDistances, prev: prev };
}

function runRecommendations() {
    if (selectedSet.size === 0) { recsPanel.style.display = 'none'; return; }
    var adj = buildAdjacency(); var sources = Array.from(selectedSet).filter(function (s) { return adj.has(String(s)); });
    if (!sources.length) { recsEl.innerHTML = '<div style="color:#888">None of the selected items exist in the graph; cannot compute recommendations.</div>'; recsPanel.style.display = 'block'; return; }
    var result = computeDistancesMultiSource(adj, sources); var distances = result.distancesMap; var candidates = [];
    distances.forEach(function (dist, nodeId) { if (selectedSet.has(nodeId)) return; if (!isFinite(dist)) return; var node = nodesMap.get(nodeId); var label = node ? (node.title || node.name || '') : ''; candidates.push({ id: nodeId, title: label, distance: dist }); });
    candidates.sort(function (a, b) { return a.distance - b.distance; }); var best = candidates.slice(0, 60); var worst = candidates.slice(-4);
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
        if (genreStr) { var g = document.createElement('div'); g.className = 'item-sub'; g.textContent = genreStr; left.appendChild(g); }

        var scaledScore = (1 / it.distance) * selectedSet.size; var scoreStr = isFinite(scaledScore) ? scaledScore.toFixed(4) : '0.0000';
        var right = document.createElement('div'); right.className = 'badge'; right.textContent = scoreStr;

        overlay.appendChild(left); overlay.appendChild(right); el.appendChild(overlay);

        el.addEventListener('mouseenter', function (e) { showTooltip(e, desc); });
        el.addEventListener('mousemove', moveTooltip);
        el.addEventListener('mouseleave', hideTooltip);

        left.addEventListener('click', function (e) {
            e.stopPropagation();
        });
        el.addEventListener('click', function () { selectedSet.add(it.id); updateSelectedBar(); var ch = Array.from(resultsEl.children).find(function (c) { return c.dataset && c.dataset.id === it.id; }); if (ch) ch.classList.add('selected'); runRecommendations(); });

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