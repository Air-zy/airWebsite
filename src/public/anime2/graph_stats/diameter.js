export function bfsShortestPaths(graph, start) {
    const dist = new Map();
    const queue = [start];
    dist.set(start, 0);

    while (queue.length) {
        const node = queue.shift();
        const neighbors = graph.get(node);
        for (const n of neighbors.keys()) {
            if (!dist.has(n)) {
                dist.set(n, dist.get(node) + 1);
                queue.push(n);
            }
        }
    }
    return Array.from(dist.values());
}

export function exactGraphDiameter(graph) {
    const allDistances = [];
    let diameter = 0;

    for (const node of graph.keys()) {
        const distances = bfsShortestPaths(graph, node);
        allDistances.push(...distances);
        const localMax = Math.max(...distances);
        if (localMax > diameter) diameter = localMax;
    }

    allDistances.sort((a,b)=>a-b);
    const idx90 = Math.floor(allDistances.length * 0.9);
    const effectiveDiameter = allDistances[idx90];

    return { diameter, effectiveDiameter };
}
