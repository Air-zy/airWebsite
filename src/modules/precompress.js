// brotli for the files that only change on deploy, squeezed once after the boot minify instead of on every request.
// cloudflare caches none of the .tsv, .wasm and .bin it gets (cf-cache-status DYNAMIC), so every visit made this
// server squeeze them again: the chess openings (437 KB at quality 11) took 10s live. 11 is brotli's smallest, a file
// over 10 MB gets 5 (cynical's 43 MB wasm, where 9 saves 0.02% and 11 would take minutes). smallest first, so the text
// is ready within seconds of boot and the wasm after. until a file's .br is written the compression middleware in
// server.js squeezes it on the fly as before
const fs = require('fs/promises');
const path = require('path');
const zlib = require('zlib');
const brotli = require('util').promisify(zlib.brotliCompress);

const EXT = /\.(js|css|svg|tsv|wasm|bin)$/;
const ready = new Set();  // url paths (/chess/openings.tsv) whose .br is written

// one file at a time, on one of libuv's threads, so the event loop and the other threads stay free
async function precompress(dir) {
  const files = [];
  for (const rel of await fs.readdir(dir, { recursive: true })) {
    const stat = EXT.test(rel) ? await fs.stat(path.join(dir, rel)) : null;
    if (stat?.isFile()) files.push({ rel, size: stat.size });
  }
  files.sort((a, b) => a.size - b.size);
  const start = Date.now();
  for (const { rel, size } of files) {
    const file = path.join(dir, rel);
    const params = { [zlib.constants.BROTLI_PARAM_QUALITY]: size > 10e6 ? 5 : 11, [zlib.constants.BROTLI_PARAM_SIZE_HINT]: size };
    await fs.writeFile(file + '.br', await brotli(await fs.readFile(file), { params }));
    ready.add('/' + rel.split(path.sep).join('/'));
  }
  console.log(`[precompress] ${files.length} files in ${((Date.now() - start) / 1000).toFixed(1)}s`);
}

// a GET for a file with a .br, from a browser that takes brotli, gets the .br as is. anything else goes on to the
// compression middleware and express.static. only paths precompress wrote are looked up, so nothing else in dist can
// be reached through here
const serve = dir => (req, res, next) => {
  if (!['GET', 'HEAD'].includes(req.method) || !ready.has(req.path) || !/\bbr\b/.test(req.get('accept-encoding') || '')) return next();
  res.vary('Accept-Encoding').set('Content-Encoding', 'br').type(path.extname(req.path));
  res.sendFile(req.path.slice(1) + '.br', { root: dir, acceptRanges: false }, err => {
    if (!err || res.headersSent) return;
    res.removeHeader('Content-Encoding');
    next();
  });
};

module.exports = { precompress, serve };
