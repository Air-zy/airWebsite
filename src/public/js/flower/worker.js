// grows one nonflowers plant off the main thread. in: { seed }. out: { seed, bitmap, ms } or { error }.
// the bitmap is nonflowers' own 600 square stage, transparent around the plant so the page ground shows through.
// one worker per plant: nonflowers builds its noise table from the first random numbers after seeding, a second
// plant in the same worker would not match its seed
importScripts('nonflowers.js');

onmessage = ({ data: { seed } }) => {
  try {
    const t0 = performance.now();
    Math.seed(seed);
    // the plant stands on the bottom middle, the offsets are nonflowers' own
    const stage = Layer.empty(600);
    if (Math.random() <= 0.5) woody({ ctx: stage, xof: 300, yof: 550 });
    else herbal({ ctx: stage, xof: 300, yof: 600 });
    const bitmap = stage.canvas.transferToImageBitmap();
    postMessage({ seed, bitmap, ms: performance.now() - t0 }, [bitmap]);
  } catch (e) {
    postMessage({ error: String(e) });
  }
};
