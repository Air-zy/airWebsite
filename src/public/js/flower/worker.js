// grows one nonflowers plant off the main thread and stipples it with the same blue noise as the page grain.
// in: { seed, size } where size is the side of the square in dots. out: { seed, size, rgba, noise, ms } or { error }.
// rgba is the plant's colour with alpha 255 where a dot is on and 0 where it is off, noise is each dot's threshold
// so the page can choose the order dots appear in. one worker per plant: nonflowers builds its noise table from
// the first random numbers after seeding, a second plant in the same worker would not match its seed
importScripts('nonflowers.js');

// the 64 square threshold tile from src/config/blueNoise.js, fetched while the plant grows
const tile = fetch('/img/blue-noise.png')
  .then(r => r.blob())
  .then(b => createImageBitmap(b, { colorSpaceConversion: 'none' }))
  .then(img => {
    const c = new OffscreenCanvas(img.width, img.height).getContext('2d');
    c.drawImage(img, 0, 0);
    return { n: img.width, px: c.getImageData(0, 0, img.width, img.height).data };
  });

onmessage = async ({ data: { seed, size } }) => {
  try {
    const t0 = performance.now();
    Math.seed(seed);
    // nonflowers' own stage, 600 square with the plant standing on the bottom middle
    const stage = Layer.empty(600);
    if (Math.random() <= 0.5) woody({ ctx: stage, xof: 300, yof: 550 });
    else herbal({ ctx: stage, xof: 300, yof: 600 });

    const out = new OffscreenCanvas(size, size).getContext('2d', { willReadFrequently: true });
    out.imageSmoothingQuality = 'high';
    out.drawImage(stage.canvas, 0, 0, size, size);
    const img = out.getImageData(0, 0, size, size), px = img.data;

    const { n, px: blue } = await tile;
    const noise = new Uint8Array(size * size);
    for (let i = 0; i < noise.length; i++) {
      const t = blue[((((i / size) | 0) % n) * n + (i % size) % n) * 4];
      noise[i] = t;
      // alpha / 255 against (t + 0.5) / 256, so alpha 255 beats every threshold and alpha 0 none
      px[i * 4 + 3] = px[i * 4 + 3] * 256 > (t + 0.5) * 255 ? 255 : 0;
    }
    postMessage({ seed, size, rgba: px.buffer, noise: noise.buffer, ms: performance.now() - t0 }, [px.buffer, noise.buffer]);
  } catch (e) {
    postMessage({ error: String(e) });
  }
};
