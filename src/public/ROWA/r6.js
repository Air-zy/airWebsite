// rowa2 3d podium figures. builds an r6 rig from /api/rowa-rig out of roblox's own r6
// meshes, poses it, renders it once with three.js and hands back an image url, so the page
// treats it like any other picture.

// only pulled in when a figure is actually wanted. the posing page loads its controls off
// the same version through these
export const THREE_CDN = 'https://cdn.jsdelivr.net/npm/three@0.160.0/';
let three;
export const loadThree = () => (three ??= import(THREE_CDN + '+esm'));

// studs, torso centred on the origin. pivot is where the r6 Motor6D sits (its C0), so poses
// bend at the same joints roblox's do. hips are on the torso's outer bottom corners, not
// the middle of each leg
export const PARTS = {
  torso: { at: [0, 0, 0], pivot: [0, 0, 0] },
  head: { at: [0, 1.5, 0], pivot: [0, 1, 0] },
  rightArm: { at: [1.5, 0, 0], pivot: [1, 0.5, 0] },
  leftArm: { at: [-1.5, 0, 0], pivot: [-1, 0.5, 0] },
  rightLeg: { at: [0.5, -2, 0], pivot: [1, -1, 0] },
  leftLeg: { at: [-0.5, -2, 0], pivot: [-1, -1, 0] }
};

// where each accessory slot sits on an r6 rig, part local, straight from roblox's R6 model
const ATTACH = {
  HatAttachment: ['head', [0, 0.6, 0]],
  HairAttachment: ['head', [0, 0.6, 0]],
  FaceFrontAttachment: ['head', [0, 0, -0.6]],
  FaceCenterAttachment: ['head', [0, 0, 0]],
  NeckAttachment: ['torso', [0, 1, 0]],
  BodyFrontAttachment: ['torso', [0, 0, -0.5]],
  BodyBackAttachment: ['torso', [0, 0, 0.5]],
  LeftCollarAttachment: ['torso', [-1, 1, 0]],
  RightCollarAttachment: ['torso', [1, 1, 0]],
  WaistFrontAttachment: ['torso', [0, -1, -0.5]],
  WaistCenterAttachment: ['torso', [0, -1, 0]],
  WaistBackAttachment: ['torso', [0, -1, 0.5]],
  LeftShoulderAttachment: ['leftArm', [0, 1, 0]],
  RightShoulderAttachment: ['rightArm', [0, 1, 0]],
  LeftGripAttachment: ['leftArm', [0, -1, 0]],
  RightGripAttachment: ['rightArm', [0, -1, 0]],
  LeftFootAttachment: ['leftLeg', [0, -1, 0]],
  RightFootAttachment: ['rightLeg', [0, -1, 0]]
};

// joint rotations in radians. arms hang down -Y, +X swings them forward, +Z swings the
// right arm out and -Z the left. three more numbers move the joint that many studs from
// where it sits. az turns the camera.
// each player always gets the same one, picked off their user id.
// /posing makes these, its copy button gives a line to paste in here
export const POSES = [
  { az: -0.5, head: [-0.1, -0.51, -0.05], torso: [-0.14, 0.02, 0.04], rightArm: [2.21, -0.51, 0.42], leftArm: [2.03, -0.53, 0.35], rightLeg: [0.41, -0.01, 0.37, 0.14, 0.27, -0.52], leftLeg: [0.2, 0.26, -0.21, -0.05, 0.04, -0.2] },
  { az: 0.5, head: [-0.03, 0.59, -0.08], torso: [0.05, -0.24, 0.01], rightArm: [2.96, 0.05, -1.27, -0.41, -0.78, -0.59], leftArm: [-3.07, 0.5, -0.74, 0.16, -0.6, -0.26], rightLeg: [0, -0.38, 0], leftLeg: [-0.01, 0.56, -0.06, -0.1, 0.01, 0.06] },
  { az: 0, head: [-0.56, 0, 0], torso: [-0.21, 0, 0], rightArm: [-2.94, -0.19, -0.32, -0.36, 0.98, 0.03], leftArm: [0.33, 0.48, -0.08], rightLeg: [0.24, -0.44, 0.15, 0.06, 0, 0.03], leftLeg: [0.28, 0.36, -0.16, -0.04, 0, 0.02] },
  { az: 0, head: [0, 0.42, 0.17], torso: [-0.01, -0.61, -0.04], rightArm: [2.47, -0.43, -1.24, 0.37, 0.4, -0.41], leftArm: [1.09, -0.02, 1.01, -0.83, 0.69, 0.2], rightLeg: [-1.06, -0.05, -0.74, 0.3, -0.58, -0.24], leftLeg: [0.24, -0.38, 0.18, 0.07, 0.45, -1.02] },
  { az: 0, head: [0.04, 0, 0], torso: [-0.08, 0, 0], rightArm: [0.28, -0.56, 0.75], leftArm: [2.15, 0.9, 1.36, -0.09, -0.52, -0.58], rightLeg: [0, 0.38, 0.38, 0.02, 0.1, -0.44], leftLeg: [-0.26, -0.29, -0.25, 0.18, 0, -0.88] },
  { az: 0, head: [-0.42, -0.95, 0.01], torso: [0.87, 0.86, -0.74], rightArm: [-0.58, 0.4, 1.79, 0.2, 0.3, 0.38], leftArm: [1.7, 0.48, 0.97, -0.24, -0.15, 0.17], rightLeg: [-0.77, -0.18, 0, 0.12, 0.09, -0.55], leftLeg: [-0.74, 0, 0, 0, 0.04, -0.36] }
];

// recipe images are mostly roblox cdn thumbnails, cors * so canvas and webgl can read them
const loadImage = src => new Promise((ok, fail) => {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => ok(img);
  img.onerror = () => fail(new Error('image ' + src));
  img.src = src;
});

// three ships the draco decoder, so it comes off the same cdn as three itself
let draco;
async function decodeDraco(buf) {
  draco ??= import(THREE_CDN + 'examples/jsm/loaders/DRACOLoader.js/+esm')
    .then(({ DRACOLoader }) => new DRACOLoader().setDecoderPath(THREE_CDN + 'examples/jsm/libs/draco/'));
  const loader = await draco;
  const geo = await new Promise((ok, fail) => loader.parse(buf, ok, fail));
  if (!geo.attributes.normal) geo.computeVertexNormals();
  const a = geo.attributes;
  return {
    position: a.position.array,
    normal: a.normal.array,
    uv: a.uv ? a.uv.array : new Float32Array(a.position.count * 2),
    index: geo.index ? geo.index.array : Uint32Array.from({ length: a.position.count }, (_, i) => i)
  };
}

// by url, every avatar shares the same limb, head and compositing meshes
const meshes = {};
const loadMesh = url => (meshes[url] ??= fetch(url).then(r => {
  if (!r.ok) throw new Error('mesh ' + url);
  return r.arrayBuffer();
}).then(parseMesh).then(m => (m.draco ? decodeDraco(m.draco) : m)));

const cframe = (T, c) => new T.Matrix4().set(c[3], c[4], c[5], c[0], c[6], c[7], c[8], c[1], c[9], c[10], c[11], c[2], 0, 0, 0, 1);

// roblox mesh uvs start at the top of the image, hence no flip
function texture(T, source) {
  const t = source instanceof HTMLCanvasElement ? new T.CanvasTexture(source) : new T.Texture(source);
  t.colorSpace = T.SRGBColorSpace;
  t.flipY = false;
  t.anisotropy = 4;
  t.needsUpdate = true;
  return t;
}

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

// a body colour with images stacked on top, each stretched over the whole thing. how roblox
// builds a part's texture: colour, package base, clothing, package overlay
function paint(w, h, color, ...layers) {
  const c = canvas(w, h);
  const g = c.getContext('2d');
  g.fillStyle = '#' + (color || 'a3a2a5');
  g.fillRect(0, 0, w, h);
  for (const img of layers) if (img) g.drawImage(img, 0, 0, w, h);
  return c;
}

function meshFrom(T, geo, material) {
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.BufferAttribute(geo.position, 3));
  g.setAttribute('normal', new T.BufferAttribute(geo.normal, 3));
  g.setAttribute('uv', new T.BufferAttribute(geo.uv, 2));
  g.setIndex(new T.BufferAttribute(geo.index, 1));
  return new T.Mesh(g, material);
}

export function dispose(root) {
  root.traverse(o => {
    o.shadow?.dispose();
    if (!o.isMesh) return;
    o.geometry.dispose();
    o.material.map?.dispose();
    o.material.dispose();
  });
}

// everything a rig needs, loaded once per player and shared by every pose
const avatars = {};
export function loadAvatar(id) {
  return (avatars[id] ??= (async () => {
    const r = await fetch(`/api/rowa-rig/${id}`);
    if (!r.ok) throw new Error('rig ' + r.status);
    const rig = await r.json();
    const img = src => (src ? loadImage(src).catch(() => null) : null);
    // a broken accessory is left off rather than costing the whole figure
    const part = m => Promise.all([loadMesh(m.mesh), img(m.texture)])
      .then(([geo, tex]) => ({ ...m, geo, tex }))
      .catch(() => null);
    const each = (obj, fn) => Promise.all(Object.entries(obj).map(async ([k, v]) => [k, await fn(v)])).then(Object.fromEntries);

    const [T, shirt, pants, tshirt, face, head, limbs, composite, accessories] = await Promise.all([
      loadThree(), img(rig.shirt), img(rig.pants), img(rig.tshirt), img(rig.face),
      part(rig.head),
      each(rig.limbs, l => Promise.all([loadMesh(l.mesh), img(l.base), img(l.overlay)]).then(([geo, base, overlay]) => ({ geo, base, overlay }))),
      each(rig.composite, url => loadMesh(url).catch(() => null)),
      Promise.all(rig.accessories.map(part))
    ]);
    return { T, rig, shirt, pants, tshirt, face, head, limbs, composite, accessories: accessories.filter(Boolean) };
  })().catch(err => {
    // a failed rig can be asked for again
    delete avatars[id];
    throw err;
  }));
}

// one webgl context for every figure and the clothes, so renders queue up behind each other
let renderer;
let queue = Promise.resolve();
const gl = T => (renderer ??= new T.WebGLRenderer({ antialias: true, alpha: true }));

// shirt, pants and t-shirt laid out on the 1024x512 r6 texture the way roblox does it,
// each template drawn through a flat mesh that moves its regions to where the limbs look
function clothes(a) {
  const { T } = a;
  const scene = new T.Scene();
  ['pants', 'shirt', 'tshirt'].forEach((k, i) => {
    if (!a[k] || !a.composite[k]) return;
    const m = meshFrom(T, a.composite[k], new T.MeshBasicMaterial({ map: texture(T, a[k]), transparent: true, depthTest: false }));
    m.renderOrder = i;
    m.frustumCulled = false;
    scene.add(m);
  });
  gl(T).setSize(1024, 512, false);
  renderer.render(scene, new T.OrthographicCamera(0, 1024, 512, 0, -1000, 1000));
  const c = canvas(1024, 512);
  c.getContext('2d').drawImage(renderer.domElement, 0, 0);
  dispose(scene);
  return c;
}

export function buildRig(a) {
  const { T, rig } = a;
  const root = new T.Group(), joints = {}, frames = {};
  const material = (map, extra) => new T.MeshStandardMaterial({ map, roughness: 1, metalness: 0, ...extra });
  a.clothes ??= clothes(a);

  for (const [name, part] of Object.entries(PARTS)) {
    const joint = new T.Group();
    joint.position.fromArray(part.pivot);
    // limbs hang off the torso like r6's motor6ds, so turning the torso turns the whole body
    (name === 'torso' ? root : joints.torso).add(joint);
    joints[name] = joint;

    // an empty frame per part, accessories hang off it whatever mesh is inside
    const frame = new T.Group();
    frame.position.set(part.at[0] - part.pivot[0], part.at[1] - part.pivot[1], part.at[2] - part.pivot[2]);
    joint.add(frame);
    frames[name] = frame;

    const color = rig.colors[name];
    if (name === 'head') {
      if (!a.head) continue;
      // a dynamic head brings its own face texture, the classic one wears the face decal
      const map = a.head.tex ? paint(a.head.tex.naturalWidth, a.head.tex.naturalHeight, color, a.head.tex) : paint(256, 256, color, a.face);
      const h = meshFrom(T, a.head.geo, material(texture(T, map)));
      h.position.fromArray(a.head.offset);
      h.scale.fromArray(a.head.scale);
      frame.add(h);
    } else {
      const limb = a.limbs[name];
      frame.add(meshFrom(T, limb.geo, material(texture(T, paint(1024, 512, color, limb.base, a.clothes, limb.overlay)))));
    }
  }

  // handle = part * slot * accessoryAttachment^-1, then the mesh offset and scale
  for (const acc of a.accessories) {
    const slot = ATTACH[acc.attachment];
    if (!slot || !acc.cframe) continue;
    const mesh = meshFrom(T, acc.geo, acc.tex
      ? material(texture(T, acc.tex), { transparent: true, alphaTest: 0.05 })
      : material(null, { color: '#a3a2a5' }));
    mesh.matrixAutoUpdate = false;
    mesh.matrix = new T.Matrix4().makeTranslation(...slot[1])
      .multiply(cframe(T, acc.cframe).invert())
      .multiply(new T.Matrix4().makeTranslation(...acc.offset))
      .multiply(new T.Matrix4().makeScale(...acc.scale));
    frames[slot[0]].add(mesh);
  }
  return { root, joints, frames };
}

export function setPose(joints, pose) {
  for (const [name, joint] of Object.entries(joints)) {
    const [x = 0, y = 0, z = 0, dx = 0, dy = 0, dz = 0] = pose[name] || [];
    const p = PARTS[name].pivot;
    joint.rotation.set(x, y, z);
    joint.position.set(p[0] + dx, p[1] + dy, p[2] + dz);
  }
}

// the smallest canvas holding every visible pixel, so a figure always stands on the
// bottom edge whatever the pose or padding
function crop(src) {
  const { width: w, height: h } = src;
  const px = src.getContext('2d').getImageData(0, 0, w, h).data;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (px[(y * w + x) * 4 + 3] < 20) continue;
      x0 = Math.min(x0, x); x1 = Math.max(x1, x);
      y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    }
  }
  if (x1 < 0) return src;
  const out = canvas(x1 - x0 + 1, y1 - y0 + 1);
  out.getContext('2d').drawImage(src, x0, y0, out.width, out.height, 0, 0, out.width, out.height);
  return out;
}

const toUrl = c => new Promise(ok => c.toBlob(b => ok(b && URL.createObjectURL(b))));

// lit the way roblox's avatar thumbnails are: one strong key from above on the character's
// left and a little in front, a weak fill from the other side, so fronts stay readable and
// the sides fall into shade. small figures get no cast shadows, roblox's thumbnails dont have
// them either, the big ones get floorPass. tuned side by side against roblox's own renders
const KEY = [-8, 7, -1.5];
const FILL = [5, 2, -5];

export function addLights(T, scene) {
  const key = new T.DirectionalLight('#ffffff', 2.6);
  key.position.fromArray(KEY);
  const fill = new T.DirectionalLight('#ffffff', 0.35);
  fill.position.fromArray(FILL);
  scene.add(new T.AmbientLight('#ffffff', 0.75), key, fill);
  return key;
}

// perspective from a little above, framing whatever is in box. positive az swings round
// to the character's left, the side roblox shoots from
export function podiumCamera(T, box, az, camera = new T.PerspectiveCamera(45, 1)) {
  const sphere = box.getBoundingSphere(new T.Sphere()), el = 0.28;
  const dist = sphere.radius / Math.sin(camera.fov * Math.PI / 360);
  camera.near = dist / 10;
  camera.far = dist * 3;
  camera.updateProjectionMatrix();
  camera.position.set(-Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el))
    .multiplyScalar(dist).add(sphere.center);
  camera.lookAt(sphere.center);
  return camera;
}

// one light's shadow camera fitted round the figure, hands back how far it reaches sideways
function fitShadow(T, light, box, mapSize, radius) {
  const s = light.shadow, dir = light.target.position.clone().sub(light.position).normalize();
  const r = box.getBoundingSphere(new T.Sphere()).radius + 1;
  const corners = [0, 1, 2, 3, 4, 5, 6, 7].map(i => new T.Vector3(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z));
  const deepest = Math.max(...corners.map(p => p.sub(light.position).dot(dir)));
  Object.assign(s.camera, { left: -r, right: r, top: r, bottom: -r, near: 0.1, far: deepest + 2 });
  s.camera.updateProjectionMatrix();
  s.mapSize.set(mapSize, mapSize);
  s.radius = radius;
  s.blurSamples = 25;
  light.castShadow = true;
  return r;
}

// real shadows for the big figures, two passes onto the same canvas. first a soft light from
// overhead drops a pool round the feet onto an invisible floor, the figure drawn invisibly so
// only its shadow lands. then shot() again by the caller for the figure itself, the key
// throwing shadows across the body (arms on the chest, a hat brim on the face). the key never
// gets the floor, its long low shadow would run off across the frame
function floorPass(T, scene, box, key, shot) {
  const mats = [];
  scene.traverse(o => {
    if (!o.isMesh) return;
    o.castShadow = o.receiveShadow = true;
    mats.push(o.material);
  });
  const ghost = on => mats.forEach(m => { m.colorWrite = m.depthWrite = !on; });

  const c = box.getCenter(new T.Vector3());
  const top = new T.DirectionalLight('#ffffff', 1);
  top.position.set(c.x - 1.5, box.max.y + 8, c.z - 1);
  top.target.position.set(c.x, box.min.y, c.z);
  const r = fitShadow(T, top, box, 512, 18);
  // round and inside the shadow camera, past its edge the blur leaves streaks
  const floor = new T.Mesh(new T.CircleGeometry(r * 0.9, 48), new T.ShadowMaterial({ opacity: 0.55 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(c.x, box.min.y, c.z);
  floor.receiveShadow = true;
  scene.add(top, top.target, floor);

  ghost(true);
  shot();
  ghost(false);
  floor.visible = top.visible = false;
  fitShadow(T, key, box, 1024, 4);
}

function draw(a, pose, size, shadows) {
  const { T } = a;
  const { root, joints } = buildRig(a);
  setPose(joints, pose);

  const scene = new T.Scene();
  scene.add(root);
  const key = addLights(T, scene);
  scene.updateMatrixWorld(true);
  // framed before any floor goes in, it would blow the box up
  const box = new T.Box3().setFromObject(root);
  const camera = podiumCamera(T, box, pose.az);

  gl(T).setSize(size, size, false);
  renderer.shadowMap.enabled = shadows;
  // vsm blurs the map, so the edges go soft like a real light
  renderer.shadowMap.type = T.VSMShadowMap;
  const full = canvas(size, size);
  const shot = () => {
    renderer.render(scene, camera);
    full.getContext('2d').drawImage(renderer.domElement, 0, 0);
  };
  if (shadows) floorPass(T, scene, box, key, shot);
  shot();
  dispose(scene);
  return toUrl(crop(full));
}

// image url of the player in their pose, rejects if the rig route is off or broken
export function renderR6(userId, size = 640, shadows = false) {
  return loadAvatar(userId).then(a => {
    const job = queue.then(() => draw(a, POSES[Number(userId) % POSES.length], size, shadows));
    queue = job.catch(() => {});
    return job;
  });
}

// any picture cropped to its visible pixels, for the flat png fallback. shows it uncropped
// if the canvas cant be read, null if it wont load at all
export async function trimmed(src) {
  if (!src) return null;
  try {
    const img = await loadImage(src);
    const c = canvas(img.naturalWidth, img.naturalHeight);
    c.getContext('2d').drawImage(img, 0, 0);
    return await toUrl(crop(c));
  } catch {
    return src.startsWith('http') ? src : null;
  }
}

// roblox .mesh into flat arrays, lod 0 only. versions 1 to 7. newer uploads keep the
// geometry as a draco bitstream, that comes back as { draco } for decodeDraco
// format notes: devforum.roblox.com/t/roblox-mesh-format/326114
export function parseMesh(buf) {
  const dv = new DataView(buf), bytes = new Uint8Array(buf);
  const nl = bytes.indexOf(10);
  const version = new TextDecoder().decode(bytes.subarray(8, nl)).trim();
  const major = Number(version[0]);
  if (major === 1) return meshV1(new TextDecoder().decode(bytes.subarray(nl + 1)), version === '1.00' ? 0.5 : 1);

  let p = nl + 1, stride = 40, nVerts, nFaces, vOff, fOff;
  const lods = [];
  if (major >= 6) {
    // chunked, COREMESH holds the geometry and LODS the face ranges
    while (p < buf.byteLength) {
      const type = new TextDecoder().decode(bytes.subarray(p, p + 8));
      const size = dv.getUint32(p + 12, true), d = p + 16;
      if (type.startsWith('COREMESH')) {
        if (dv.getUint32(p + 8, true) === 2) return { draco: buf.slice(d + 4, d + 4 + dv.getUint32(d, true)) };
        nVerts = dv.getUint32(d, true);
        vOff = d + 4;
        nFaces = dv.getUint32(vOff + nVerts * 40, true);
        fOff = vOff + nVerts * 40 + 4;
      } else if (type.startsWith('LODS')) {
        const n = dv.getUint32(d + 3, true);
        for (let i = 0; i < n; i++) lods.push(dv.getUint32(d + 7 + i * 4, true));
      }
      p = d + size;
    }
  } else {
    const headerSize = dv.getUint16(p, true);
    let nLods = 0, nBones = 0;
    if (major <= 3) {
      stride = dv.getUint8(p + 2);
      if (major === 3) nLods = dv.getUint16(p + 6, true);
      nVerts = dv.getUint32(p + (major === 3 ? 8 : 4), true);
      nFaces = dv.getUint32(p + (major === 3 ? 12 : 8), true);
    } else {
      nVerts = dv.getUint32(p + 4, true);
      nFaces = dv.getUint32(p + 8, true);
      nLods = dv.getUint16(p + 12, true);
      nBones = dv.getUint16(p + 14, true);
    }
    vOff = p + headerSize;
    // skinned meshes keep 8 bytes of bone weights per vertex before the faces
    fOff = vOff + nVerts * stride + (nBones ? nVerts * 8 : 0);
    for (let i = 0; i < nLods; i++) lods.push(dv.getUint32(fOff + nFaces * 12 + i * 4, true));
  }

  // some files list [0, 0], meaning no lods rather than an empty first one
  const faces = lods[1] || nFaces;
  const position = new Float32Array(nVerts * 3), normal = new Float32Array(nVerts * 3), uv = new Float32Array(nVerts * 2);
  for (let i = 0; i < nVerts; i++) {
    const o = vOff + i * stride;
    for (let k = 0; k < 3; k++) {
      position[i * 3 + k] = dv.getFloat32(o + k * 4, true);
      normal[i * 3 + k] = dv.getFloat32(o + 12 + k * 4, true);
    }
    uv[i * 2] = dv.getFloat32(o + 24, true);
    uv[i * 2 + 1] = dv.getFloat32(o + 28, true);
  }
  const index = new Uint32Array(buf.slice(fOff, fOff + faces * 12));
  return { position, normal, uv, index };
}

// the old text format, three [x,y,z][nx,ny,nz][u,v,w] groups per triangle
function meshV1(text, scale) {
  const groups = [...text.matchAll(/\[([^\]]+)\]/g)].map(m => m[1].split(',').map(Number));
  const n = groups.length / 3;
  const position = new Float32Array(n * 3), normal = new Float32Array(n * 3), uv = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) {
    const [pos, nor, tex] = groups.slice(i * 3, i * 3 + 3);
    position.set(pos.map(v => v * scale), i * 3);
    normal.set(nor, i * 3);
    uv.set([tex[0], 1 - tex[1]], i * 2);
  }
  return { position, normal, uv, index: Uint32Array.from({ length: n }, (_, i) => i) };
}
