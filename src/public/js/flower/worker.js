// grows one nonflowers plant off the main thread. in: { seed }. out: { seed, bitmap, ms } or { error }.
// the bitmap is cropped to the plant, transparent around it so the page ground shows through.
// one worker per plant: nonflowers builds its noise table from the first random numbers after seeding, a second
// plant in the same worker would not match its seed
importScripts('nonflowers.js');

onmessage = async ({ data: { seed } }) => {
  try {
    const t0 = performance.now();
    Math.seed(seed);
    // nonflowers grows a plant in a 1200 square and stands it on the bottom middle of the stage. its own 600 stage
    // cut tall ones off at the top, a 1200 one fits any of them, then only the plant is kept
    const stage = Layer.empty(1200);
    if (Math.random() <= 0.5) woody({ ctx: stage, xof: 600, yof: 1200 });
    else herbal({ ctx: stage, xof: 600, yof: 1200 });
    const b = Layer.bound(stage);
    if (b.xmin > b.xmax) throw new Error(`seed ${seed} painted nothing`);
    const bitmap = await createImageBitmap(stage.canvas, b.xmin, b.ymin, b.xmax - b.xmin + 1, b.ymax - b.ymin + 1);
    postMessage({ seed, bitmap, ms: performance.now() - t0 }, [bitmap]);
  } catch (e) {
    postMessage({ error: String(e) });
  }
};
