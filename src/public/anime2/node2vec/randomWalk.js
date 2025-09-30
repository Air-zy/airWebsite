function weightedChoice(neighborsMap) {
    const neighbors = Array.from(neighborsMap.entries()); // [[id, weight], ...]
    const totalWeight = neighbors.reduce((sum, [_, w]) => sum + w, 0);
    const r = Math.random() * totalWeight;
    let acc = 0;
    for (const [id, w] of neighbors) {
        acc += w;
        if (r <= acc) return id;
    }
    return neighbors[neighbors.length - 1][0]; // fallback
}


// this dulls down more mainstream animes
function randomChoice(neighborsMap) {
    const neighborIds = Array.from(neighborsMap.keys());
    return neighborIds[Math.floor(Math.random() * neighborIds.length)];
}

function randomWalk(graph, startNode, walkLength = 10) {
    const walk = [startNode];

    while (walk.length < walkLength) {
        const cur = walk[walk.length - 1];
        const neighbors = graph.get(cur);
        if (!neighbors || neighbors.size === 0) break; // dead end
        const next = randomChoice(neighbors);
        //const next = weightedChoice(neighbors);
        walk.push(next);
    }

    return walk;
}

export function generateWalksForAllNodes(graph, numWalks = 5, walkLength = 10) {
    const walks = [];
    for (const node of graph.keys()) {
        for (let i = 0; i < numWalks; i++) {
            walks.push(randomWalk(graph, node, walkLength));
        }
    }
    return walks;
}

export function buildCooccurrence(walks, windowSize = 2) {
    const cooccur = new Map();
    for (const walk of walks) {
        for (let i = 0; i < walk.length; i++) {
            const src = walk[i];
            for (let j = Math.max(0, i - windowSize); j <= Math.min(walk.length - 1, i + windowSize); j++) {
                if (i === j) continue;
                const tgt = walk[j];
                if (!cooccur.has(src)) cooccur.set(src, new Map());
                cooccur.get(src).set(tgt, (cooccur.get(src).get(tgt) || 0) + 1);
            }
        }
    }
    return cooccur;
}

export function toMatrix(cooccur, nodes) {
    const mat = nodes.map(src =>
        nodes.map(tgt => cooccur.get(Number(src))?.get(Number(tgt)) || 0)
    );
    return mat;
}