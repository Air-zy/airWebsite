// the home and auth page background. blue noise grain in glitchy boxes, gathered into jigsaw clumps that fade
// in and out, and every jigsaw piece drifts and turns a little on its own clock, carrying its dots with it.
// it all runs in a fragment shader, the cpu only sends the time. 8fps is plenty, fades take 20 to 60s
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
  shader(gl.VERTEX_SHADER, 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}');
  shader(gl.FRAGMENT_SHADER,
    // the shader is one string of glsl pieces, one statement each. terser joins the pieces and drops these comments,
    // so the page gets the shader with no comments or indentation
    'precision highp float;' +
    'uniform sampler2D blue;' +
    'uniform float tile,rows,cell,t,lift,clumps,split;' +
    // a patch never reaches past this much of its size, 1.6 for the spores and 0.66 for the ragged edge
    'const float FAR=2.26;' +
    // how fast the pieces wander, and how far: a share of a piece off home and radians of turn either way.
    // a piece's corner is 0.71 from its middle and a knob tip 0.82, plus the wander that stays under 1, so only the
    // 3x3 pieces around a point can ever cover it
    'const float WANDER=.04,SHIFT=.12,TURN=.3;' +
    // so the pieces read as pieces: each is drawn this much of a piece smaller all round, which leaves a dark seam
    // where two meet, and a patch fills its pieces this densely, capped so a full one keeps about 15% of its dots
    // off and still shimmers instead of going flat
    'const float SEAM=.025,DENSITY=.75,FULLEST=.85;' +
    // 0 to 1 from a position, no sin so every gpu agrees (dave hoskins' hash12)
    'float hash(vec2 p){' +
      'vec3 p3=fract(p.xyx*.1031);' +
      'p3+=dot(p3,p3.yzx+33.33);' +
      'return fract((p3.x+p3.y)*p3.z);' +
    '}' +
    // smooth noise, and 4 octaves of it for ragged edges
    'float noise(vec2 p){' +
      'vec2 i=floor(p),f=fract(p);' +
      'f=f*f*(3.-2.*f);' +
      'return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+1.),f.x),f.y);' +
    '}' +
    'float fbm(vec2 p){' +
      'float v=0.,a=.5;' +
      'for(int i=0;i<4;i++){' +
        'v+=a*noise(p);' +
        'p*=2.;' +
        'a*=.5;' +
      '}' +
      'return v;' +
    '}' +
    // jigsaw pieces are 128px and every shared edge has a round knob poking one way. these are the knobs poking
    // into cell g, right left down up, as middle and radius in the cell's -0.5 to 0.5 units, radius 0 if it pokes
    // out. both neighbours hash the same edge so they agree
    'void knobs(vec2 g,out vec3 r,out vec3 l,out vec3 d,out vec3 u){' +
      'float hr=hash(g+vec2(.37,0.)),hl=hash(g-vec2(.63,0.));' +
      'float hd=hash(g+vec2(0.,.71)),hu=hash(g-vec2(0.,.29));' +
      'r=vec3(.35,fract(hr*7.)*.2-.1,hr<.5?.17:0.);' +
      'l=vec3(-.35,fract(hl*7.)*.2-.1,hl>=.5?.17:0.);' +
      'd=vec3(fract(hd*7.)*.2-.1,.35,hd<.5?.17:0.);' +
      'u=vec3(fract(hu*7.)*.2-.1,-.35,hu>=.5?.17:0.);' +
    '}' +
    // whether q, in piece g's own units with its middle at 0, is on that piece: its square, minus the knobs its
    // neighbours poke into it, plus its own knobs poking out. an outgoing knob is the neighbour's incoming one seen
    // from this side, 0.65 out where the neighbour has it 0.35 in, and it exists where the incoming radius is 0.
    // the whole outline sits SEAM inside the true one: square smaller, own knobs thinner, the holes wider
    'bool onPiece(vec2 q,vec2 g){' +
      'vec3 r,l,d,u;' +
      'knobs(g,r,l,d,u);' +
      'float own=.17-SEAM;' +
      'if((r.z==0.&&length(q-vec2(.65,r.y))<own)||(l.z==0.&&length(q-vec2(-.65,l.y))<own)' +
        '||(d.z==0.&&length(q-vec2(d.x,.65))<own)||(u.z==0.&&length(q-vec2(u.x,-.65))<own))' +
        'return true;' +
      'bool hole=(r.z>0.&&length(q-r.xy)<r.z+SEAM)||(l.z>0.&&length(q-l.xy)<l.z+SEAM)' +
        '||(d.z>0.&&length(q-d.xy)<d.z+SEAM)||(u.z>0.&&length(q-u.xy)<u.z+SEAM);' +
      'return max(abs(q.x),abs(q.y))<.5-SEAM&&!hole;' +
    '}' +
    // the piece over p (px), the higher one where two overlap, false in a gap between them. home is p carried back
    // to where it sits on that piece unmoved, so the patches, boxes and dots ride along with the piece
    'bool pieceAt(vec2 p,out vec2 owner,out vec2 home){' +
      'vec2 g=floor(p/128.);' +
      'float top=-1.;' +
      'for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){' +
        'vec2 n=g+vec2(float(x),float(y));' +
        // three slow wobbles per piece, each read off its own row of the noise
        'float s=t*WANDER;' +
        'vec2 off=(vec2(noise(vec2(s,hash(n)*97.)),noise(vec2(s,hash(n+3.1)*97.)))-.5)*2.*SHIFT;' +
        'float a=(noise(vec2(s,hash(n+5.7)*97.))-.5)*2.*TURN;' +
        'vec2 q=p/128.-n-.5-off;' +
        'q=vec2(cos(a)*q.x+sin(a)*q.y,cos(a)*q.y-sin(a)*q.x);' +
        'float z=hash(n+31.7);' +
        'if(z>top&&onPiece(q,n)){' +
          'top=z;' +
          'owner=n;' +
          'home=(n+.5+q)*128.;' +
        '}' +
      '}' +
      'return top>=0.;' +
    '}' +
    // a bushy patch in whole pieces, d is 1 at its edge. inside gets the fill, a thin ring past it like spores.
    // the edge creeps, so the steps are ramps: a piece the edge crosses fades over seconds and its dots dissolve one
    // at a time. a hard step switched the whole piece in one frame, a visible flicker
    'float patch(float d,float fill){' +
      'return mix(fill,.15,smoothstep(.85,1.15,d))*(1.-smoothstep(1.45,1.75,d));' +
    '}' +
    // how full the grain is at p (px), owner is the jigsaw piece p is in. at most one clump per 256px slot,
    // each fading on its own clock. slots 2 away are checked since a side bush spills that far
    'float clump(vec2 p,vec2 owner){' +
      'vec2 slot=floor(p/256.);' +
      // bushy parts come in whole pieces, so they are judged at the piece middle
      'vec2 pc=(owner+.5)*128.;' +
      // one flat amount per piece so pieces and knobs show, a few missing like a half done puzzle
      'float h=hash(owner+19.3);' +
      'float fill=hash(owner+21.7)<.15?0.:.3+1.7*h*h;' +
      // only worked out once a patch is near, 9 means not yet
      'float edge=9.;' +
      'float f=0.;' +
      'for(int y=-2;y<=2;y++)for(int x=-2;x<=2;x++){' +
        'vec2 s=slot+vec2(float(x),float(y));' +
        'if(hash(s)>clumps)continue;' +
        'vec2 at=(s+.3+.4*vec2(hash(s+7.1),hash(s+3.7)))*256.;' +
        // most clumps are tight blocks, some bushy patches. anything that cant reach p is dropped before the
        // rest of its hashes, a bushy one is at most 112px and a block 45
        'bool bushy=hash(s+4.4)>.65;' +
        'if(bushy&&length(pc-at)>FAR*112.)continue;' +
        'bool grows=!bushy&&hash(s+12.3)<.6;' +
        'if(!bushy&&!grows&&max(abs(p.x-at.x),abs(p.y-at.y))>45.)continue;' +
        'vec2 reach=128.*(.1+.25*vec2(hash(s+1.3),hash(s+5.9)))*(bushy?2.5:1.);' +
        'vec2 q=(p-at)/reach;' +
        'float square=max(abs(q.x),abs(q.y)),circle=length((pc-at)/reach);' +
        'bool block=!bushy&&square<1.;' +
        'bool bush=bushy&&circle<FAR;' +
        // a block often grows a 256 to 512px bush off one side
        'float rooted=FAR;' +
        'if(grows){' +
          'float side=hash(s+11.1);' +
          'vec2 dir=side<.5?vec2(side<.25?1.:-1.,0.):vec2(0.,side<.75?1.:-1.);' +
          'float r=256.*(.5+.5*hash(s+14.2));' +
          'vec2 root=at+(dir+dir.yx*(hash(s+13.7)-.5)*1.2)*reach+dir*r*.6;' +
          'rooted=length(pc-root)/r;' +
        '}' +
        'bool growth=rooted<FAR;' +
        'if(!block&&!bush&&!growth)continue;' +
        // some get a straight cut, one side gone
        'float cut=hash(s+6.6);' +
        'if(cut<.4){' +
          'float along=(cut<.2?q.x:q.y)-(hash(s+8.8)-.5);' +
          'if(hash(s+2.2)<.5?along>0.:along<0.)continue;' +
        '}' +
        // ragged edge so patches take an uneven set of pieces, drifting so they creep
        'if((bush||growth)&&edge>8.)edge=(fbm(pc*.03+t*.02)-.47)*1.4;' +
        'float v=block?1.-smoothstep(.7,1.,square):0.;' +
        'if(bush)v=patch(circle+edge,fill);' +
        'if(growth)v=max(v,patch(rooted+edge,fill));' +
        // each patch breathes on its own clock between half and full, it never goes out. a screen holds about 8, and
        // when they could reach 0 a few of the big ones lining up emptied the screen, 30x fewer dots than at a peak
        'float life=mix(.5,1.,smoothstep(.1,.9,.5+.5*sin(t*(.1+.2*hash(s+9.2))+hash(s+2.4)*6.283)));' +
        'f=max(f,life*v);' +
      '}' +
      'return f;' +
    '}' +
    'void main(){' +
      // cells counted from the top left, gl counts rows up from the bottom
      'vec2 c=vec2(floor(gl_FragCoord.x),rows-1.-floor(gl_FragCoord.y));' +
      // which piece this cell lands on now. the outline is tested every cell, so knobs stay crisp as pieces move
      'vec2 owner,home;' +
      'if(!pieceAt((c+.5)*cell,owner,home)){' +
        'gl_FragColor=vec4(0.);' +
        'return;' +
      '}' +
      // macroblocks like a glitched video frame, 8 cells down to 1, laid out on the unmoved piece so they turn
      // with it. a hash decides each split
      'vec2 lc=floor(home/cell);' +
      'float size=8.;' +
      'vec2 box=floor(lc/size);' +
      'for(int i=0;i<3;i++){' +
        'if(hash(box+size*37.)>split)break;' +
        'size*=.5;' +
        'box=floor(lc/size);' +
      '}' +
      // the box reads the clumps once at its middle and goes on or off as a whole. a clump fills about
      // 3 in 4 boxes, and blue noise per box keeps them spread out. each box's threshold wobbles a little on its
      // own 4 to 8s clock, so boxes near it twinkle while the patch as a whole holds steady
      'vec2 m=(box+.5)*size*cell;' +
      'float twinkle=.015*sin(t*(.8+.6*hash(box+size*5.))+hash(box+size*7.)*6.283);' +
      'bool on=min(DENSITY*clump(m,owner),FULLEST)>texture2D(blue,(box+size*13.+.5)/tile).r+twinkle;' +
      'gl_FragColor=on?vec4(vec3(lift),1.):vec4(0.);' +
    '}');
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

  // reduced motion gets one still frame, and so does webgl drawn on the cpu (no gpu, or a blocked one), where a
  // frame of this shader holds the page's main thread for 100ms or more. firefox without the extension still
  // answers gl.RENDERER with the real name
  const info = gl.getExtension('WEBGL_debug_renderer_info');
  const cpu = /swiftshader|llvmpipe|softpipe|software|basic render/i.test(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER));
  const still = cpu || matchMedia('(prefers-reduced-motion: reduce)').matches;
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
