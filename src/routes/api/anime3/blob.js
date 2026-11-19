// the anime graph's blobs (def/<name> in the second firestore), read once and kept as the finished answer, brotlied.
// they only change when i upload new ones, which a restart picks up. before this every visit read every chunk again
// (about 4s) and squeezed the 6 MB answer on the spot, 20 to 30 MB of memory a request. the brotli is ~4 MB to keep
const zlib = require('zlib');
const crypto = require('crypto');
const { promisify } = require('util');
const brotli = promisify(zlib.brotliCompress);
const unbrotli = promisify(zlib.brotliDecompress);
const { readChunks } = require('../../../firebase/firebasedb2.js');

const answers = new Map(); // name -> promise of { br, etag }

function answer(name) {
  if (!answers.has(name)) {
    const job = (async () => {
      const json = Buffer.from(JSON.stringify({ data: await readChunks(name) }));
      // 5 like the other api answers. the data is base64 of bytes that are already packed, so 11 saves little
      const br = await brotli(json, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 5, [zlib.constants.BROTLI_PARAM_SIZE_HINT]: json.length } });
      return { br, etag: `"${crypto.createHash('sha1').update(br).digest('base64url')}"` };
    })();
    answers.set(name, job);
    job.catch(() => answers.delete(name)); // a failed read gets another go on the next visit
  }
  return answers.get(name);
}

// pick turns the request into a blob name
module.exports = pick => async (req, res) => {
  const name = pick(req);
  try {
    const { br, etag } = await answer(name);
    // send answers a matching If-None-Match with a 304 itself
    res.vary('Accept-Encoding').set('ETag', etag).type('json');
    if (req.acceptsEncodings('br')) return res.set('Content-Encoding', 'br').send(br);
    res.send(await unbrotli(br)); // a client without brotli, rare enough to unpack each time
  } catch (err) {
    console.error('[anime3]', name, err);
    res.status(500).json({ error: 'anime3 load error' });
  }
};
