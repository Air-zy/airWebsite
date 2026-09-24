// the auth page background. two dithers stacked on two moving fields, blue noise grain over coarse bayer bands,
// xor'd so where both land they cancel. every cell is worked out in a fragment shader, so the cpu only sends
// 3 light positions a frame and a 4k screen costs about what a small one does.
// drawn at a quarter size and scaled up pixelated. 15fps is part of the look, not a budget
(async () => {
  const CELL = 4; // css px per dither cell
  const ALPHA = 18 / 255; // how strong it shows
  // three soft lights drifting on slow loops. strength, speed, phase
  const LIGHTS = [[0.55, 0.05, 0], [0.45, 0.037, 2], [0.4, 0.029, 4]];

  // the same threshold tiles the css dithers use, blue-noise.png comes from src/config/blueNoise.js.
  // fetched first so they download while the context and shader get made
  const tiles = ['/img/blue-noise.png', '/img/bayer.png'].map(src => {
    const img = new Image();
    img.src = src;
    return img.decode().then(() => img);
  });

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
    uniform sampler2D blue, bayer;
    uniform vec2 tiles; // blue and bayer tile sizes
    uniform vec3 lights[3]; // x and y in cells, strength
    uniform float rows, r2, t, alpha;

    float threshold(sampler2D tile, float size, vec2 c) {
      return texture2D(tile, (mod(c, size) + 0.5) / size).r;
    }

    void main() {
      // cells counted from the top left, gl counts rows up from the bottom
      vec2 c = vec2(floor(gl_FragCoord.x), rows - 1.0 - floor(gl_FragCoord.y));
      // starts below 0 so the far tails of the lights leave real dark gaps instead of a thin wash
      float f = -0.06;
      for (int k = 0; k < 3; k++) {
        vec2 d = c - lights[k].xy;
        f += lights[k].z * exp(-dot(d, d) / r2);
      }
      bool grain = f > threshold(blue, tiles.x, c);
      // the bayer layer gets bands drifting up, only the positive halves show so half the screen has none
      float bands = 0.3 * max(0.0, sin(c.x * 0.015 + t * 0.2)) * sin(c.y * 0.08 + t * 0.6);
      bool coarse = bands > threshold(bayer, tiles.y, c);
      // white for grain, grey for the bayer layer, nothing where both or neither land. premultiplied
      float v = grain == coarse ? 0.0 : grain ? 1.0 : 0.5;
      float a = v > 0.0 ? alpha : 0.0;
      gl_FragColor = vec4(vec3(v * a), a);
    }`);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return console.error(gl.getProgramInfoLog(prog));
  gl.useProgram(prog);
  const [uTiles, uLights, uRows, uR2, uT, uAlpha, uBlue, uBayer] =
    ['tiles', 'lights', 'rows', 'r2', 't', 'alpha', 'blue', 'bayer'].map(n => gl.getUniformLocation(prog, n));

  // raw gray values, no color management touching them
  gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
  function upload(unit, img) {
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    // nearest and clamped, bayer is 24px and webgl1 allows nothing else on a size that is not a power of two
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return img.width;
  }
  const [blue, bayer] = await Promise.all(tiles);
  const blueSize = upload(0, blue), bayerSize = upload(1, bayer);
  gl.uniform1i(uBlue, 0);
  gl.uniform1i(uBayer, 1);
  gl.uniform2f(uTiles, blueSize, bayerSize);
  gl.uniform1f(uAlpha, ALPHA);

  // one triangle big enough to cover the screen
  const p = gl.getAttribLocation(prog, 'p');
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(p);
  gl.vertexAttribPointer(p, 2, gl.FLOAT, false, 0, 0);

  canvas.id = 'bg';
  canvas.ariaHidden = 'true';
  document.body.prepend(canvas);

  let W, H;
  function resize() {
    W = Math.ceil(innerWidth / CELL);
    H = Math.ceil(innerHeight / CELL);
    canvas.width = W;
    canvas.height = H;
    canvas.style.width = `${W * CELL}px`;
    canvas.style.height = `${H * CELL}px`;
    gl.viewport(0, 0, W, H);
    gl.uniform1f(uRows, H);
    gl.uniform1f(uR2, (Math.max(W, H) * 0.22) ** 2);
  }

  function draw(t) {
    gl.uniform1f(uT, t);
    gl.uniform3fv(uLights, LIGHTS.flatMap(([strength, speed, phase]) => [
      W * (0.5 + 0.4 * Math.sin(t * speed + phase)),
      H * (0.5 + 0.4 * Math.sin(t * speed * 1.3 + phase * 2)),
      strength,
    ]));
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  // reduced motion gets one still frame
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const now = () => still ? 0 : performance.now() / 1000;
  resize();
  draw(now());
  addEventListener('resize', () => { resize(); draw(now()); });
  if (still) return;
  let last = 0;
  requestAnimationFrame(function tick(ms) {
    requestAnimationFrame(tick);
    if (ms - last < 1000 / 15) return;
    last = ms;
    draw(ms / 1000);
  });
})();
