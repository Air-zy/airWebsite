export function mdsMain(map, nodes) {
    nodes.forEach(id => {
        const emb = map[id]?.embd; // embd aka svd results {q:number, u:numbers}
        if (emb) {
            // Take the first two values of emb.u as x and y
            const sigma = emb.q
            const values = Object.values(emb.u);
            const x = values[0]*sigma;
            const y = values[1]*sigma;
            map[id].pos = { x, y };
        }
    });
}
