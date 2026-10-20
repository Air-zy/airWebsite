// roblox model files, binary .rbxm and the older xml form, into a flat list of
// { className, props, children, parent }. only decodes the property types the rowa2
// rig reads (strings, numbers, vectors, cframes, content), anything else is skipped.
// format reference: github.com/rojo-rbx/rbx-dom/blob/master/docs/binary.md
const zlib = require('zlib');

function lz4(src, outLen) {
  const out = Buffer.alloc(outLen);
  let i = 0, o = 0;
  const run = n => { let b; do { b = src[i++]; n += b; } while (b === 255); return n; };
  while (i < src.length) {
    const token = src[i++];
    const lit = (token >> 4) === 15 ? run(15) : token >> 4;
    src.copy(out, o, i, i + lit);
    i += lit;
    o += lit;
    if (i >= src.length) break;
    const back = src[i] | (src[i + 1] << 8);
    i += 2;
    const len = ((token & 15) === 15 ? run(15) : token & 15) + 4;
    for (let k = 0; k < len; k++, o++) out[o] = out[o - back];
  }
  return out;
}

const f32 = new DataView(new ArrayBuffer(4));

class Reader {
  constructor(b) { this.b = b; this.p = 0; }
  u8() { return this.b[this.p++]; }
  u32() { const v = this.b.readUInt32LE(this.p); this.p += 4; return v; }
  str() { const n = this.u32(); const s = this.b.toString('utf8', this.p, this.p + n); this.p += n; return s; }
  // n big endian u32s stored byte plane by byte plane
  planes(n) {
    const { b, p } = this, out = new Array(n);
    for (let i = 0; i < n; i++) out[i] = ((b[p + i] << 24) | (b[p + n + i] << 16) | (b[p + 2 * n + i] << 8) | b[p + 3 * n + i]) >>> 0;
    this.p += 4 * n;
    return out;
  }
  ints(n) { return this.planes(n).map(v => (v >>> 1) ^ -(v & 1)); }
  // 8 byte planes, zigzagged. asset ids fit a double fine
  int64s(n) {
    const { b, p } = this, out = new Array(n);
    for (let i = 0; i < n; i++) {
      let v = 0n;
      for (let k = 0; k < 8; k++) v = (v << 8n) | BigInt(b[p + k * n + i]);
      out[i] = Number((v >> 1n) ^ -(v & 1n));
    }
    this.p += 8 * n;
    return out;
  }
  // sign bit lives in the lowest bit
  floats(n) { return this.planes(n).map(v => { f32.setUint32(0, ((v >>> 1) | (v << 31)) >>> 0); return f32.getFloat32(0); }); }
  refs(n) { let acc = 0; return this.ints(n).map(d => (acc += d)); }
  vec3s(n) { const x = this.floats(n), y = this.floats(n), z = this.floats(n); return x.map((_, i) => [x[i], y[i], z[i]]); }
}

// special cframe ids are axis aligned, (id - 1) picks the right and up vectors
const AXES = [[1, 0, 0], [0, 1, 0], [0, 0, 1], [-1, 0, 0], [0, -1, 0], [0, 0, -1]];
function specialRotation(id) {
  const r = AXES[Math.floor((id - 1) / 6)], u = AXES[(id - 1) % 6];
  const b = [r[1] * u[2] - r[2] * u[1], r[2] * u[0] - r[0] * u[2], r[0] * u[1] - r[1] * u[0]];
  return [r[0], u[0], b[0], r[1], u[1], b[1], r[2], u[2], b[2]];
}

// one array of values for a PROP chunk, null for types the rig never needs
function readValues(r, type, n) {
  switch (type) {
    case 0x01: return Array.from({ length: n }, () => r.str());
    case 0x02: return Array.from({ length: n }, () => r.u8() === 1);
    case 0x03: return r.ints(n);
    case 0x04: return r.floats(n);
    case 0x0C: case 0x0E: return r.vec3s(n);
    case 0x12: return r.planes(n);
    case 0x1B: return r.int64s(n);
    case 0x10: {
      const rots = Array.from({ length: n }, () => {
        const id = r.u8();
        if (id) return specialRotation(id);
        const m = [];
        for (let k = 0; k < 9; k++) { m.push(r.b.readFloatLE(r.p)); r.p += 4; }
        return m;
      });
      return r.vec3s(n).map((pos, i) => [...pos, ...rots[i]]);
    }
    case 0x22: {
      // newer Content type, uris are listed once in order for the entries that use one
      const kinds = r.planes(n);
      const uris = Array.from({ length: r.u32() }, () => r.str());
      let u = 0;
      return kinds.map(k => (k === 1 ? uris[u++] : ''));
    }
    default: return null;
  }
}

function parseBinary(buf) {
  const byRef = new Map(), classes = new Map();
  let p = 32;
  while (p < buf.length) {
    const name = buf.toString('latin1', p, p + 4).replace(/\0+$/, '');
    const comp = buf.readUInt32LE(p + 4), raw = buf.readUInt32LE(p + 8);
    let data = buf.subarray(p + 16, p + 16 + (comp || raw));
    p += 16 + (comp || raw);
    if (name === 'END') break;
    if (comp) data = data.readUInt32BE(0) === 0x28b52ffd ? zlib.zstdDecompressSync(data) : lz4(data, raw);

    const r = new Reader(data);
    if (name === 'INST') {
      const id = r.u32(), className = r.str();
      r.u8();
      const refs = r.refs(r.u32());
      classes.set(id, refs);
      for (const ref of refs) byRef.set(ref, { className, props: {}, children: [], parent: null });
    } else if (name === 'PROP') {
      const refs = classes.get(r.u32()), prop = r.str(), type = r.u8();
      const values = refs && readValues(r, type, refs.length);
      if (values) refs.forEach((ref, i) => { byRef.get(ref).props[prop] = values[i]; });
    } else if (name === 'PRNT') {
      r.u8();
      const n = r.u32(), kids = r.refs(n), parents = r.refs(n);
      kids.forEach((k, i) => {
        const parent = byRef.get(parents[i]);
        if (!parent) return;
        byRef.get(k).parent = parent;
        parent.children.push(byRef.get(k));
      });
    }
  }
  return [...byRef.values()];
}

const XML_NUMBERS = new Set(['float', 'double', 'int', 'int64', 'token']);

function xmlValue({ type, fields, text }) {
  if (type === 'Vector3') return ['X', 'Y', 'Z'].map(k => Number(fields[k]));
  if (type === 'CoordinateFrame' || type === 'CFrame') {
    return ['X', 'Y', 'Z', 'R00', 'R01', 'R02', 'R10', 'R11', 'R12', 'R20', 'R21', 'R22'].map(k => Number(fields[k]));
  }
  if ('url' in fields) return fields.url.trim();
  if (type === 'bool') return text.trim() === 'true';
  if (XML_NUMBERS.has(type)) return Number(text);
  return text;
}

// a tag walker, not a real xml parser. model files are machine written and regular enough
function parseXml(text) {
  text = text.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
  const all = [], stack = [];
  let prop = null, field = null;
  for (const [, close, tag, attrs, selfClose, txt] of text.matchAll(/<(\/?)([\w:]+)([^>]*?)(\/?)>|([^<]+)/g)) {
    if (txt !== undefined) {
      if (prop && field) prop.fields[field] = (prop.fields[field] || '') + txt;
      else if (prop) prop.text += txt;
      continue;
    }
    if (tag === 'Item') {
      if (close) { stack.pop(); continue; }
      const parent = stack.at(-1) || null;
      const inst = { className: /class="([^"]+)"/.exec(attrs)[1], props: {}, children: [], parent };
      if (parent) parent.children.push(inst);
      all.push(inst);
      stack.push(inst);
    } else if (!stack.length || tag === 'Properties') {
      continue;
    } else if (!prop) {
      const name = /name="([^"]+)"/.exec(attrs);
      if (!close && name) prop = { name: name[1], type: tag, fields: {}, text: '' };
      if (prop && selfClose) { stack.at(-1).props[prop.name] = xmlValue(prop); prop = null; }
    } else if (close && tag === prop.type) {
      stack.at(-1).props[prop.name] = xmlValue(prop);
      prop = field = null;
    } else if (!selfClose) {
      field = close ? null : tag;
    }
  }
  return all;
}

function parse(buf) {
  return buf.toString('latin1', 0, 8) === '<roblox!' ? parseBinary(buf) : parseXml(buf.toString('utf8'));
}

module.exports = { parse };

// node src/routes/rblxapp/rbxm.js
// rojo's cframe-special-cases test model, 24 CFrameValues named after their special id
if (require.main === module) {
  const assert = require('assert');
  const sample = Buffer.from('PHJvYmxveCGJ/w0KGgoAAAEAAAAYAAAAAAAAAAAAAABNRVRBJAAAACIAAAAAAAAA8BMBAAAAEgAAAEV4cGxpY2l0QXV0b0pvaW50cwQAAAB0cnVlSU5TVCcAAAB4AAAAAAAAAPAGAAAAAAsAAABDRnJhbWVWYWx1ZQAYFQAPAgA1HQIBAFACAgICAlBST1AqAAAAfAAAAAAAAADwDQAAAAATAAAAQXR0cmlidXRlc1NlcmlhbGl6ZQEcAA8CAERQAAAAAABQUk9QdAAAAJ0AAAAAAAAA8QQAAAAABAAAAE5hbWUBAgAAADAyBgARMwYAETUGABE2BgARNwYAETkGABFhBgARYwYAEWQGABBlBgAhMTAGABExBgARNAYAAUIAETE8ACExOBIAAUIAITFiDAABQgASMTwAEGYSABEyQgCAMjICAAAAMjNQUk9QKAAAANYAAAAAAAAA8AcAAAAADQAAAFNvdXJjZUFzc2V0SWQbFgAPAgCRHgEBAFABAQEBAVBST1AaAAAAbQAAAAAAAADQAAAAAAQAAABUYWdzAQ0ADwIARFAAAAAAAFBST1A1AAAARgEAAAAAAADwFwAAAAAFAAAAVmFsdWUQAgMFBgcJCgwNDhARFBUXGBkbHB4fICIjJgAPAgD/BVAAAAAAAFBSTlQaAAAAxQAAAAAAAAA/ABgAAQA4HwIBAAMPYgA1HgFJAFAAAAAAAEVORAAAAAAACQAAAAAAAAA8L3JvYmxveD4=', 'base64');
  const tree = parse(sample);
  assert.strictEqual(tree.length, 24);
  const rot = name => tree.find(t => t.props.Name === name).props.Value.slice(3);
  assert.deepStrictEqual(rot('02'), [1, 0, 0, 0, 1, 0, 0, 0, 1]);
  assert.deepStrictEqual(rot('03'), [1, 0, 0, 0, 0, -1, 0, 1, 0]);
  assert.deepStrictEqual(rot('14'), [-1, 0, 0, 0, 1, 0, 0, 0, -1]);
  // every special rotation is orthonormal and right handed
  for (const t of tree) {
    const [a, b, c, d, e, f, g, h, i] = t.props.Value.slice(3);
    assert.strictEqual(a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g), 1, t.props.Name);
  }
  console.log('rbxm ok');
}
