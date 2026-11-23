// a firestore doc read at most every 30s, one read at a time. a failed read serves the last good copy, only a first
// read that fails throws. get.set(value) swaps in what a save just wrote. the projects and the friends use it
module.exports = (name, read) => {
  let data = null;
  let fetchedAt = 0;
  let reading = null;
  let saves = 0; // a read that was out when a save landed may hold the copy from before it, so it's dropped

  async function get() {
    if (!data || Date.now() - fetchedAt > 30 * 1000) {
      const savesAtStart = saves;
      reading ??= read()
        .then(d => {
          if (saves !== savesAtStart) return;
          data = d;
          fetchedAt = Date.now();
        })
        .catch(err => {
          if (!data) throw err;
          console.error(`[${name}] read failed, serving the last copy:`, err.message);
        })
        .finally(() => { reading = null; });
      await reading;
    }
    return data;
  }

  get.set = next => {
    saves++;
    data = next;
    fetchedAt = Date.now();
    return next;
  };
  return get;
};

// node src/routes/api/cached.js
if (require.main === module) {
  const a = require('assert');
  (async () => {
    let reads = 0, down = false;
    const get = module.exports('test', async () => {
      reads++;
      if (down) throw new Error('down');
      return { n: reads };
    });

    const [x, y] = await Promise.all([get(), get()]);
    a.strictEqual(reads, 1, 'two at once share one read');
    a.strictEqual(x, y);
    await get();
    a.strictEqual(reads, 1, 'fresh for 30s');
    get.set({ n: 'saved' });
    a.deepStrictEqual(await get(), { n: 'saved' }, 'a save shows straight away');

    const now = Date.now;
    Date.now = () => now() + 31 * 1000;
    down = true;
    a.deepStrictEqual(await get(), { n: 'saved' }, 'a failed read serves the last copy');
    a.strictEqual(reads, 2);
    Date.now = now;

    let release;
    const slow = module.exports('test', () => new Promise(r => { release = r; }));
    const out = slow();
    slow.set({ n: 'saved' });
    release({ n: 'from before the save' });
    a.deepStrictEqual(await out, { n: 'saved' }, 'a read that was out during a save does not undo it');
    a.deepStrictEqual(await slow(), { n: 'saved' });

    await a.rejects(module.exports('test', async () => { throw new Error('down'); })(), /down/, 'nothing to serve yet, so it throws');
    console.log('cached ok');
  })();
}
