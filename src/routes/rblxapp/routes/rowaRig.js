const zlib = require('zlib');
const { assetKey, getAsset } = require('../rowautils.js');
const { parse } = require('../rbxm.js');

// what an r6 rig in rowa2 can wear. layered clothing and r15 body parts dont exist on r6,
// so only the rigid accessory slots, plus classic clothing and faces
const RIGID = new Set([8, 41, 42, 43, 44, 45, 46, 47]);
const DYNAMIC_HEAD = 79;
// body packages (torso, arms, legs) keep an r6 version of themselves as a CharacterMesh
const PACKAGE = new Set([27, 28, 29, 30, 31]);
const CHARACTER_MESH = [null, 'torso', 'leftArm', 'rightArm', 'leftLeg', 'rightLeg'];
// each of these is a tiny model wrapping one image: [recipe key, class, property]
const IMAGES = {
  2: ['tshirt', 'ShirtGraphic', 'Graphic'],
  11: ['shirt', 'Shirt', 'ShirtTemplate'],
  12: ['pants', 'Pants', 'PantsTemplate'],
  18: ['face', 'Decal', 'Texture']
};

// roblox's own r6 pieces, public assets: the bevelled limbs, the classic head, the meshes
// that lay shirt/pants/t-shirt templates out onto the r6 texture, and the stock face.
// the same ids roblox's web avatar previewers load
const R6_BASE = {
  limbs: { torso: 2957740857, leftArm: 2957740508, rightArm: 2957740703, leftLeg: 2957740624, rightLeg: 2957740776 },
  head: 2957715294,
  composite: { shirt: 2957742631, pants: 2957742558, tshirt: 2957742706 },
  face: 2957705858
};

// only ids that came out of a recipe go through the asset route, so it isnt an open
// proxy onto the asset key
const allowed = new Set();
// rbxassetid://123 and http://www.roblox.com/asset/?id=123 both end in the id
function allow(content) {
  const m = /(\d+)\s*$/.exec(content || '');
  if (m) allowed.add(m[1]);
  return m ? m[1] : null;
}
const allowId = v => (v ? allow(String(v)) : null);
for (const group of Object.values(R6_BASE)) {
  for (const id of typeof group === 'object' ? Object.values(group) : [group]) allowId(id);
}

function accessoryOf(tree) {
  const acc = tree.find(t => t.className === 'Accessory' || t.className === 'Hat');
  const handle = acc && acc.children.find(c => c.props.Name === 'Handle');
  if (!handle) return null;

  const att = handle.children.find(c => c.className === 'Attachment');
  // old hats have no Attachment, they sit on the head top through AttachmentPoint
  const base = att
    ? { attachment: att.props.Name, cframe: att.props.CFrame }
    : { attachment: 'HatAttachment', cframe: acc.props.AttachmentPoint };

  if (handle.className === 'MeshPart') {
    const size = handle.props.size, init = handle.props.InitialSize || size;
    return {
      ...base,
      mesh: allow(handle.props.MeshId || handle.props.MeshContent),
      texture: allow(handle.props.TextureID || handle.props.TextureContent),
      scale: size.map((v, i) => v / init[i]),
      offset: [0, 0, 0]
    };
  }
  const special = handle.children.find(c => c.className === 'SpecialMesh' && c.props.MeshType === 5);
  if (!special) return null;
  return {
    ...base,
    mesh: allow(special.props.MeshId),
    texture: allow(special.props.TextureId),
    scale: special.props.Scale,
    offset: special.props.Offset
  };
}

const proxied = id => `/api/rowa-asset/${id}`;

// images go out as roblox's own 420px thumbnails, a fifth the size of a 1024 texture and
// plenty for a figure this big. same aspect, no padding, so uvs and templates still line up
async function imageUrls(ids) {
  const out = {};
  if (!ids.length) return out;
  try {
    const r = await fetch(`https://thumbnails.roproxy.com/v1/assets?assetIds=${ids.join(',')}&size=420x420&format=Png&isCircular=false`, { signal: AbortSignal.timeout(8000) });
    const { data = [] } = r.ok ? await r.json() : {};
    for (const t of data) if (t.state === 'Completed' && t.imageUrl) out[t.targetId] = t.imageUrl;
  } catch (err) {
    console.error('[rig thumbs]', err.message);
  }
  return out;
}

async function buildRig(userId) {
  const r = await fetch(`https://avatar.roproxy.com/v2/avatar/users/${userId}/avatar`, { signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error('avatar ' + r.status);
  const av = await r.json();
  const c = av.bodyColor3s || {};
  const rig = {
    colors: {
      head: c.headColor3, torso: c.torsoColor3,
      leftArm: c.leftArmColor3, rightArm: c.rightArmColor3,
      leftLeg: c.leftLegColor3, rightLeg: c.rightLegColor3
    },
    limbs: Object.fromEntries(Object.entries(R6_BASE.limbs).map(([k, id]) => [k, { mesh: id }])),
    head: { mesh: R6_BASE.head, scale: [1, 1, 1], offset: [0, 0, 0] },
    composite: { ...R6_BASE.composite },
    face: R6_BASE.face,
    accessories: []
  };
  let dynamicHead = false;

  // one bad item costs that item, not the whole avatar
  await Promise.all((av.assets || []).map(async a => {
    const type = a.assetType.id;
    try {
      if (IMAGES[type]) {
        const [key, cls, prop] = IMAGES[type];
        const inst = parse(await getAsset(a.id)).find(t => t.className === cls);
        const id = allow(inst && inst.props[prop]);
        if (id) rig[key] = id;
      } else if (RIGID.has(type)) {
        const acc = accessoryOf(parse(await getAsset(a.id)));
        if (acc && acc.mesh) rig.accessories.push(acc);
      } else if (PACKAGE.has(type)) {
        for (const cm of parse(await getAsset(a.id)).filter(t => t.className === 'CharacterMesh')) {
          const limb = CHARACTER_MESH[cm.props.BodyPart];
          if (!limb || !cm.props.MeshId) continue;
          rig.limbs[limb] = { mesh: allowId(cm.props.MeshId), base: allowId(cm.props.BaseTextureId), overlay: allowId(cm.props.OverlayTextureId) };
        }
      } else if (type === DYNAMIC_HEAD) {
        // delivered as the SpecialMesh roblox puts on an r6 Head, face baked into the texture
        const m = parse(await getAsset(a.id)).find(t => t.className === 'SpecialMesh');
        const mesh = m && allow(m.props.MeshId);
        if (!mesh) return;
        rig.head = { mesh, texture: allow(m.props.TextureId), scale: m.props.Scale, offset: m.props.Offset };
        dynamicHead = true;
      }
    } catch (err) {
      console.error('[rig]', a.id, err.message);
    }
  }));
  // a dynamic head wins over a classic face, the face is part of its texture
  if (dynamicHead) rig.face = null;

  // ids become urls the page can load straight away. clothing templates go full size,
  // they get laid out at 1024 wide. everything else rides on thumbnails
  const limbs = Object.values(rig.limbs);
  const small = [rig.face, rig.head.texture, ...rig.accessories.map(a => a.texture), ...limbs.flatMap(l => [l.base, l.overlay])];
  const urls = await imageUrls([...new Set(small.filter(Boolean))]);
  const thumb = id => id && (urls[id] || proxied(id));
  const full = id => id && proxied(id);

  for (const k of ['shirt', 'pants', 'tshirt']) rig[k] = full(rig[k]);
  for (const k of Object.keys(rig.composite)) rig.composite[k] = full(rig.composite[k]);
  rig.face = thumb(rig.face);
  for (const m of [rig.head, ...rig.accessories]) {
    m.mesh = full(m.mesh);
    m.texture = thumb(m.texture);
  }
  for (const l of limbs) {
    l.mesh = full(l.mesh);
    l.base = thumb(l.base);
    l.overlay = thumb(l.overlay);
  }
  return rig;
}

// avatars change, an hour is fine for a leaderboard
const RIG_TTL = 60 * 60 * 1000;
const rigs = new Map();

async function rig(req, res) {
  const uid = Number(req.params.userId);
  if (!Number.isInteger(uid) || uid <= 0) return res.status(400).json({ error: 'bad id' });
  if (!assetKey) return res.status(503).json({ error: 'no asset key' });

  let hit = rigs.get(uid);
  if (!hit || Date.now() - hit.at > RIG_TTL) {
    hit = { at: Date.now(), job: buildRig(uid) };
    rigs.set(uid, hit);
    hit.job.catch(() => rigs.delete(uid));
  }
  try {
    res.json(await hit.job);
  } catch (err) {
    console.error('[rig]', uid, err.message);
    res.status(502).json({ error: 'rig failed' });
  }
}

async function asset(req, res) {
  const id = req.params.assetId;
  if (!allowed.has(id)) return res.status(404).end();
  try {
    const buf = await getAsset(id);
    const type = buf[0] === 0x89 && buf[1] === 0x50 ? 'image/png'
      : buf[0] === 0xff && buf[1] === 0xd8 ? 'image/jpeg'
      : 'application/octet-stream';
    res.set('Cache-Control', 'public, max-age=86400').type(type);
    // meshes halve under gzip but the global compression skips octet-stream
    if (type === 'application/octet-stream' && req.acceptsEncodings('gzip')) {
      return res.set({ 'Content-Encoding': 'gzip', Vary: 'Accept-Encoding' }).send(zlib.gzipSync(buf));
    }
    res.send(buf);
  } catch (err) {
    console.error('[rig asset]', id, err.message);
    res.status(502).end();
  }
}

module.exports = { rig, asset };
