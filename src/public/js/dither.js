// the home and auth page background. blue noise grain in glitchy boxes, gathered into jigsaw clumps that fade
// in and out. it all runs in a fragment shader, the cpu only sends the time. 8fps is plenty, fades take 20 to 60s
(async () => {
  const CELL = 2; // css px per cell, clumps are sized in px so this only changes the grain
  // --dither-lift in the page css. the css color-dodges the canvas so a dot brightens what is under it by 1 / (1 - lift)
  const LIFT = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--dither-lift')) || 0.3;
  // chance each 256px slot holds a clump, lower is sparser
  const CLUMPS = 0.5;
  // chance a box splits on its way from 8 cells down to 1, lower is chunkier
  const SPLIT = 0.55;

  // threshold tile from src/config/blueNoise.js, fetched first so it downloads while the shader compiles
  const tile = new Image();
  tile.src = '/img/blue-noise.png';
  const decoded = tile.decode();

  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl', { antialias: false, depth: false });
  // ponytail: no webgl, or a lost context after a gpu reset, leaves the plain gradient until a reload
  if (!gl) return;

  const prog = gl.createProgram();
  const shader = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    gl.attachShader(prog, s);
  };
  shader(gl.VERTEX_SHADER, 'attribute vec2 p; void main() { gl_Position = vec4(p, 0.0, 1.0); }');
  shader(gl.FRAGMENT_SHADER, `
    precision highp float;
    uniform sampler2D blue;
    uniform float tile, rows, cell, t, lift, clumps, split;

    // a patch never reaches past this much of its size, 1.6 for the spores and 0.66 for the ragged edge
    const float FAR = 2.26;

    // 0 to 1 from a position, no sin so every gpu agrees (dave hoskins' hash12)
    float hash(vec2 p) {
      vec3 p3 = fract(p.xyx * 0.1031);
      p3 += dot(p3, p3.yzx + 33.33);
      return fract((p3.x + p3.y) * p3.z);
    }

    // smooth noise, and 4 octaves of it for ragged edges
    float noise(vec2 p) {
      vec2 i = floor(p), f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + 1.0), f.x), f.y);
    }
    float fbm(vec2 p) {
      float v = 0.0, a = 0.5;
      for (int i = 0; i < 4; i++) {
        v += a * noise(p);
        p *= 2.0;
        a *= 0.5;
      }
      return v;
    }

    // jigsaw pieces are 128px and every shared edge has a round knob poking one way. these are the knobs poking
    // into cell g, right left down up, as middle and radius in the cell's -0.5 to 0.5 units, radius 0 if it pokes
    // out. both neighbours hash the same edge so they agree
    void knobs(vec2 g, out vec3 r, out vec3 l, out vec3 d, out vec3 u) {
      float hr = hash(g + vec2(0.37, 0.0)), hl = hash(g - vec2(0.63, 0.0));
      float hd = hash(g + vec2(0.0, 0.71)), hu = hash(g - vec2(0.0, 0.29));
      r = vec3(0.35, fract(hr * 7.0) * 0.2 - 0.1, hr < 0.5 ? 0.17 : 0.0);
      l = vec3(-0.35, fract(hl * 7.0) * 0.2 - 0.1, hl >= 0.5 ? 0.17 : 0.0);
      d = vec3(fract(hd * 7.0) * 0.2 - 0.1, 0.35, hd < 0.5 ? 0.17 : 0.0);
      u = vec3(fract(hu * 7.0) * 0.2 - 0.1, -0.35, hu >= 0.5 ? 0.17 : 0.0);
    }
    bool inside(vec2 q, vec3 k) {
      return length(q - k.xy) < k.z;
    }
    // whether a knob's round edge runs through the box lo to hi
    bool crosses(vec2 lo, vec2 hi, vec3 k) {
      return length(clamp(k.xy, lo, hi) - k.xy) < k.z && length(max(abs(lo - k.xy), abs(hi - k.xy))) > k.z;
    }

    // a bushy patch in whole pieces, d is 1 at its edge. inside gets the fill, a thin ring past it like spores
    float patch(float d, float fill) {
      return d < 1.0 ? fill : d < 1.6 ? 0.15 : 0.0;
    }

    // how full the grain is at p (px), owner is the jigsaw piece p is in. at most one clump per 256px slot,
    // each fading on its own clock. slots 2 away are checked since a side bush spills that far
    float clump(vec2 p, vec2 owner) {
      vec2 slot = floor(p / 256.0);
      // bushy parts come in whole pieces, so they are judged at the piece middle
      vec2 pc = (owner + 0.5) * 128.0;
      // one flat amount per piece so pieces and knobs show, a few missing like a half done puzzle
      float h = hash(owner + 19.3);
      float fill = hash(owner + 21.7) < 0.15 ? 0.0 : 0.3 + 1.7 * h * h;
      // only worked out once a patch is near, 9 means not yet
      float edge = 9.0;
      float f = 0.0;
      for (int y = -2; y <= 2; y++) for (int x = -2; x <= 2; x++) {
        vec2 s = slot + vec2(float(x), float(y));
        if (hash(s) > clumps) continue;
        vec2 at = (s + 0.3 + 0.4 * vec2(hash(s + 7.1), hash(s + 3.7))) * 256.0;
        // most clumps are tight blocks, some bushy patches. anything that cant reach p is dropped before the
        // rest of its hashes, a bushy one is at most 112px and a block 45
        bool bushy = hash(s + 4.4) > 0.65;
        if (bushy && length(pc - at) > FAR * 112.0) continue;
        bool grows = !bushy && hash(s + 12.3) < 0.6;
        if (!bushy && !grows && max(abs(p.x - at.x), abs(p.y - at.y)) > 45.0) continue;
        vec2 reach = 128.0 * (0.1 + 0.25 * vec2(hash(s + 1.3), hash(s + 5.9))) * (bushy ? 2.5 : 1.0);
        vec2 q = (p - at) / reach;
        float square = max(abs(q.x), abs(q.y)), circle = length((pc - at) / reach);
        bool block = !bushy && square < 1.0;
        bool bush = bushy && circle < FAR;
        // a block often grows a 256 to 512px bush off one side
        float rooted = FAR;
        if (grows) {
          float side = hash(s + 11.1);
          vec2 dir = side < 0.5 ? vec2(side < 0.25 ? 1.0 : -1.0, 0.0) : vec2(0.0, side < 0.75 ? 1.0 : -1.0);
          float r = 256.0 * (0.5 + 0.5 * hash(s + 14.2));
          vec2 root = at + (dir + dir.yx * (hash(s + 13.7) - 0.5) * 1.2) * reach + dir * r * 0.6;
          rooted = length(pc - root) / r;
        }
        bool growth = rooted < FAR;
        if (!block && !bush && !growth) continue;
        // some get a straight cut, one side gone
        float cut = hash(s + 6.6);
        if (cut < 0.4) {
          float along = (cut < 0.2 ? q.x : q.y) - (hash(s + 8.8) - 0.5);
          if (hash(s + 2.2) < 0.5 ? along > 0.0 : along < 0.0) continue;
        }
        // ragged edge so patches take an uneven set of pieces, drifting so they creep
        if ((bush || growth) && edge > 8.0) edge = (fbm(pc * 0.03 + t * 0.02) - 0.47) * 1.4;
        float v = block ? 1.0 - smoothstep(0.7, 1.0, square) : 0.0;
        if (bush) v = patch(circle + edge, fill);
        if (growth) v = max(v, patch(rooted + edge, fill));
        float life = smoothstep(0.1, 0.6, 0.5 + 0.5 * sin(t * (0.1 + 0.2 * hash(s + 9.2)) + hash(s + 2.4) * 6.283));
        f = max(f, life * v);
      }
      return f;
    }

    void main() {
      // cells counted from the top left, gl counts rows up from the bottom
      vec2 c = vec2(floor(gl_FragCoord.x), rows - 1.0 - floor(gl_FragCoord.y));

      // the jigsaw cell. boxes line up with its straight edges so only a knob can cut through a box
      vec2 g = floor(c * cell / 128.0);
      vec3 kr, kl, kd, ku;
      knobs(g, kr, kl, kd, ku);

      // macroblocks like a glitched video frame, 8 cells down to 1. a hash decides each split, and a box a knob
      // edge runs through always splits so knobs stay crisp
      float size = 8.0;
      vec2 box = floor(c / size);
      for (int i = 0; i < 3; i++) {
        vec2 lo = box * size * cell / 128.0 - g - 0.5, hi = lo + size * cell / 128.0;
        bool knob = crosses(lo, hi, kr) || crosses(lo, hi, kl) || crosses(lo, hi, kd) || crosses(lo, hi, ku);
        if (!knob && hash(box + size * 37.0) > split) break;
        size *= 0.5;
        box = floor(c / size);
      }

      // the piece the box's middle is in, its own cell unless it sits in a neighbour's knob
      vec2 m = (box + 0.5) * size * cell;
      vec2 q = m / 128.0 - g - 0.5;
      vec2 owner = inside(q, kr) ? g + vec2(1.0, 0.0) : inside(q, kl) ? g - vec2(1.0, 0.0)
        : inside(q, kd) ? g + vec2(0.0, 1.0) : inside(q, ku) ? g - vec2(0.0, 1.0) : g;

      // the box reads the clumps once at its middle and goes on or off as a whole. a clump fills about
      // 4 in 10 boxes, and blue noise per box keeps them spread out
      bool on = 0.4 * clump(m, owner) > texture2D(blue, (box + size * 13.0 + 0.5) / tile).r;
      gl_FragColor = on ? vec4(vec3(lift), 1.0) : vec4(0.0);
    }`);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return console.error(gl.getProgramInfoLog(prog));
  gl.useProgram(prog);
  const [uTile, uRows, uCell, uT, uLift, uClumps, uSplit] =
    ['tile', 'rows', 'cell', 't', 'lift', 'clumps', 'split'].map(n => gl.getUniformLocation(prog, n));

  // raw gray values, no color management touching them
  gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
  await decoded;
  gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, tile);
  // nearest, no mipmaps. 64 is a power of two so it keeps the default repeat and tiles itself
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.uniform1f(uTile, tile.width);
  gl.uniform1f(uCell, CELL);
  gl.uniform1f(uLift, LIFT);
  gl.uniform1f(uClumps, CLUMPS);
  gl.uniform1f(uSplit, SPLIT);

  // one triangle big enough to cover the screen
  const p = gl.getAttribLocation(prog, 'p');
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(p);
  gl.vertexAttribPointer(p, 2, gl.FLOAT, false, 0, 0);

  canvas.id = 'bg';
  canvas.ariaHidden = 'true';
  // behind everything and pinned to the screen, the page css only adds how it blends
  canvas.style.cssText = 'position: fixed; top: 0; left: 0; z-index: -1; image-rendering: pixelated; pointer-events: none';
  document.body.prepend(canvas);

  function resize() {
    const W = Math.ceil(innerWidth / CELL), H = Math.ceil(innerHeight / CELL);
    canvas.width = W;
    canvas.height = H;
    canvas.style.width = `${W * CELL}px`;
    canvas.style.height = `${H * CELL}px`;
    gl.viewport(0, 0, W, H);
    gl.uniform1f(uRows, H);
  }

  // reduced motion gets one still frame
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const now = () => still ? 0 : performance.now() / 1000;

  function draw(t) {
    gl.uniform1f(uT, t);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  resize();
  draw(now());
  addEventListener('resize', () => { resize(); draw(now()); });
  if (still) return;
  let last = 0;
  requestAnimationFrame(function tick(ms) {
    requestAnimationFrame(tick);
    if (ms - last < 1000 / 8) return;
    last = ms;
    draw(ms / 1000);
  });
})();
