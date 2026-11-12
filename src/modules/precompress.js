// brotli for the files that only change on deploy, squeezed once after the boot minify instead of on every request.
// cloudflare caches none of the .tsv, .wasm and .bin it gets (cf-cache-status DYNAMIC), so every visit made this
// server squeeze them again: the chess openings (437 KB at quality 11) took 10s live. it caches no pages either, and
// those are fixed once the minify has filled their tokens. 11 is brotli's smallest, a file over 10 MB gets 5 (cynical's
// 43 MB wasm, where 11 saves 1.5% for 100x the time). smallest first, so the text is ready within seconds of boot and
// the wasm after. until a file's .br is written the compression middleware in server.js squeezes it on the fly
const fs = require('fs/promises');
const path = require('path');
const zlib = require('zlib');
const brotli = require('util').promisify(zlib.brotliCompress);

const EXT = /\.(html|js|css|svg|tsv|wasm|bin)$/;
const ready = new Set();  // url paths (/chess/openings.tsv) whose .br is written
let root;                 // the dist they're in

// one file at a time, on one of libuv's threads, so the event loop and the other threads stay free
async function precompress(dir) {
  root = dir;
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

// file (a url path, /chess.html) as its .br when that's written and the browser takes brotli, else next(). only paths
// precompress wrote are looked up, so nothing else in dist can be reached through here
function send(file, req, res, next) {
  if (!ready.has(file) || !/\bbr\b/.test(req.get('accept-encoding') || '')) return next();
  res.vary('Accept-Encoding').set('Content-Encoding', 'br').type(path.extname(file));
  res.sendFile(file.slice(1) + '.br', { root, acceptRanges: false }, err => {
    if (!err || res.headersSent) return;
    res.removeHeader('Content-Encoding');
    next();
  });
}

// in front of express.static, so a file gets everything static's would (the auth pages' frame-ancestors header, the
// login cookie) but from its .br. a folder's url means its index.html, as with static, so / is index.html
const serve = (req, res, next) => ['GET', 'HEAD'].includes(req.method)
  ? send(req.path.endsWith('/') ? req.path + 'index.html' : req.path, req, res, next) : next();

// a route's page: its .br, or the file itself for compression to squeeze
const page = (file, dir) => (req, res) => send(file, req, res, () => res.sendFile(file, { root: dir }));

module.exports = { precompress, serve, page };
