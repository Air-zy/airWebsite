// the breakdown. click the 🤓 by the name and the site falls apart. a crack runs out of it along the wall, and when it
// snaps the page breaks bit by bit as the shock gets to it. words and letters go crooked, hang off one corner, get
// misspelled or drop to the bottom of the screen and pile up, the ones on the crack rip in half, links, buttons and
// pictures come loose and the plant tips over. then a glitchy mechanical spider made of lines and ascii walks down the
// screen and fixes all of it with its legs. it jabs the crooked ones straight, reels the fallen ones back up on a
// thread, welds the ripped ones back together and zips the crack shut as it passes.
//
// main.js only loads this on that click. a click or esc skips to the end. reduced motion gets a still version, things
// go crooked and come back one at a time, with no crack, shaking, falling or spider.
//
// nothing is a picture of the page. a word that breaks is wrapped in a span and hidden, and a copy with the same font
// and colour stands in for it over the page, so every word moves on its own. links, buttons, pictures, notes and the
// plant are the real ones, moved where they are with transform. once something's fixed the real one shows again, and
// at the end the spans come back out, so the page is left exactly how it was
(() => {
  // ---------- tuning
  const T_CRACK = 0.65;     // s, the crack runs along the wall, then it snaps
  const WAVE = 1500;        // px/s, the snap spreads out from the 🤓 and breaks things as it gets to them
  const T_SPIDER = 1.4;     // s after the snap, the spider walks in
  const KICK = 18;          // px, the shake at the snap
  const GRAVITY = 2300;     // px/s²
  const MAX_WORDS = 120;    // the most words and letters that break, the ones near the 🤓 first
  const MAX_TAPS = 15;      // what broke is grouped into about this many jabs for the spider
  const HEAL_STEP = 0.011;  // s per point of the crack, how fast it zips shut

  // the spider is drawn in 2.5d. the camera looks at the page a little from below, so something z px off the page
  // shows PY*z higher up the screen, and the light is up and to the left, so its shadow falls down and right of it
  const PY = 0.55, SHX = 0.42, SHY = 0.3;
  const LEN = [1.08, 1, 0.95, 1.04];   // leg length, front pair to back
  // eyes on the head: forward, out, up (of the head's radii), and size. each one twice, left and right
  const EYES = [[0.78, 0.3, 0.45, 2.3], [0.62, 0.6, 0.62, 1.4], [0.92, 0.12, 0.2, 1.3]];
  // the ascii on its back, front row first. a few characters flicker into others
  const PANEL = ['/\\/\\', '|##|', '|%%|', '|##|', '\\/\\/'];

  const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
  const GLYPHS = '#%&@*+=-:./\\|<>[]{}01';
  const VOID_COL = '#09090c';
  const SKIP = 'script, style, textarea, dialog, #adapt';
  // these move as one piece. all other text breaks word by word, and big text letter by letter
  const RIGID = 'nav .nav-item, .menu-icon, .bubble, .flower canvas, main img, main svg, main button, main .sticky';
  const BROKEN = new Set(['crook', 'typo', 'hang', 'fall', 'topple']);
  // typos: the keys around each key, and the glitchy look-alikes
  const NEAR = {
    a: 'qwsz', b: 'vghn', c: 'xdfv', d: 'serfcx', e: 'wsdr', f: 'drtgvc', g: 'ftyhbv', h: 'gyujnb', i: 'ujko',
    j: 'huikmn', k: 'jiolm', l: 'kop', m: 'njk', n: 'bhjm', o: 'iklp', p: 'ol', q: 'wa', r: 'edft', s: 'awedxz',
    t: 'rfgy', u: 'yhji', v: 'cfgb', w: 'qase', x: 'zsdc', y: 'tghu', z: 'asx',
  };
  const LEET = { a: '4', b: '8', e: '3', g: '9', i: '1', l: '|', o: '0', s: '5', t: '7', z: '2' };

  const nav = document.querySelector('nav');
  const main = document.getElementById('main-content');
  const bubble = document.querySelector('.bubble');
  const css = getComputedStyle(document.documentElement);
  const cssVar = n => css.getPropertyValue(n).trim();
  const hex = h => /^#[0-9a-f]{6}$/i.test(h) && [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const mix = (a, b, t) => {
    const x = hex(a), y = hex(b);
    return x && y ? `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * t))})` : a;
  };
  const C = {
    text: cssVar('--text-normal'), grey: cssVar('--text-grey'), accent: cssVar('--accent'), tech: cssVar('--hl-tech'),
  };
  // --text-soft is a color-mix, which a canvas might not take
  C.soft = mix(C.grey, C.text, 0.45);

  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = s => s[Math.floor(Math.random() * s.length)];
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const ease = p => 1 - (1 - clamp(p, 0, 1)) ** 3;
  const wrapAngle = a => Math.atan2(Math.sin(a), Math.cos(a));
  const el = (tag, style) => { const e = document.createElement(tag); e.style.cssText = style; return e; };
  // chrome leaves style="" behind if the attribute is removed right after a .style write, reading it first syncs it
  const restoreStyle = (e, style) => (e.getAttribute('style'), style == null ? e.removeAttribute('style') : e.setAttribute('style', style));
  // a moved element back to how it was. the bubble eases its transform, it would glide home from wherever it fell
  // when skipped, so it goes back with transitions off first
  const release = (e, style) => {
    e.style.transition = 'none';
    e.style.transform = e.style.filter = '';
    getComputedStyle(e).transform;
    restoreStyle(e, style);
  };
  const line = (g, a, b) => { g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke(); };
  // on screen, and its shadow on the page
  const P = p => ({ x: p.x, y: p.y - p.z * PY });
  const SH = p => ({ x: p.x + p.z * SHX, y: p.y + p.z * SHY });

  let run = null, frame = 0;

  // ---------- the crack

  // jagged, across the whole screen through the 🤓. the left half heads for the middle of the name, so it rips
  function crackLine(o, W, H, aim) {
    const left = [], right = [];
    for (const [dir, out] of [[-1, left], [1, right]]) {
      let x = o.x, y = o.y;
      const drift = rand(-0.25, 0.25);
      while (dir < 0 ? x > -40 : x < W + 40) {
        x += dir * rand(10, 22);
        y += rand(-8, 8) + drift * 10 + (dir < 0 ? (aim - y) * 0.14 : 0);
        out.push({ x, y: clamp(y, o.y - H * 0.25, o.y + H * 0.25) });
        y = out.at(-1).y;
      }
    }
    const points = [...left.reverse(), { ...o }, ...right];
    // short cracks off the main one
    const branches = Array.from({ length: 10 }, () => {
      const at = Math.floor(rand(2, points.length - 2));
      let a = rand(0, Math.PI * 2), p = points[at];
      const path = [p];
      for (let i = 0; i < 5; i++) {
        a += rand(-0.6, 0.6);
        p = { x: p.x + Math.cos(a) * rand(10, 26), y: p.y + Math.sin(a) * rand(10, 26) };
        path.push(p);
      }
      return { at, path };
    });
    return { points, origin: left.length, branches };
  }

  // the crack's height at x
  function crackAt(crack, x) {
    const p = crack.points;
    for (let i = 1; i < p.length; i++) {
      if (p[i].x >= x) return p[i - 1].y + (p[i].y - p[i - 1].y) * ((x - p[i - 1].x) / (p[i].x - p[i - 1].x || 1));
    }
    return p.at(-1).y;
  }

  // ---------- typos

  // a believable one: two letters swapped, the key next to it, a doubled or dropped letter, or a glitchy look-alike.
  // never the first letter, people rarely get that one wrong
  function typo(word) {
    const ch = [...word], at = ch.flatMap((c, i) => (/[a-z]/i.test(c) ? [i] : []));
    if (at.length < 3) return null;
    const i = at[1 + Math.floor(Math.random() * (at.length - 1))], c = ch[i], low = c.toLowerCase();
    const x = Math.random();
    if (x < 0.3 && /[a-z]/i.test(ch[i - 1] || '') && ch[i - 1] !== c) [ch[i - 1], ch[i]] = [ch[i], ch[i - 1]];
    else if (x < 0.55 && NEAR[low]) ch[i] = c === low ? pick(NEAR[low]) : pick(NEAR[low]).toUpperCase();
    else if (x < 0.7) ch.splice(i, 0, c);
    else if (x < 0.82) ch.splice(i, 1);
    else ch[i] = LEET[low] || pick(GLYPHS);
    const out = ch.join('');
    return out === word ? null : out;
  }
  const glitched = s => [...s].map(c => (c !== ' ' && Math.random() < 0.35 ? pick(GLYPHS) : c)).join('');

  // ---------- what breaks

  // words keep the look of where they sit. underlines belong to the link around a word, not the word, so they come
  // from the nearest one up that has one
  const TEXT_PROPS = ['font-family', 'font-size', 'font-weight', 'font-style', 'font-stretch', 'font-variant',
    'font-feature-settings', 'font-variation-settings', 'font-kerning', 'letter-spacing', 'text-transform', 'color',
    'text-shadow', '-webkit-text-fill-color', '-webkit-text-stroke-width', '-webkit-text-stroke-color'];
  const DECO_PROPS = ['text-decoration-line', 'text-decoration-style', 'text-decoration-color',
    'text-decoration-thickness', 'text-underline-offset'];
  function textLook(span) {
    const cs = getComputedStyle(span);
    let look = TEXT_PROPS.map(p => `${p}:${cs.getPropertyValue(p)}`).join(';');
    for (let e = span.parentElement; e && e !== main && e !== nav; e = e.parentElement) {
      const es = getComputedStyle(e);
      if (es.textDecorationLine !== 'none') {
        look += ';' + DECO_PROPS.map(p => `${p}:${es.getPropertyValue(p)}`).join(';');
        break;
      }
      if (es.display !== 'inline') break;
    }
    return look;
  }

  function actor(r, o) {
    const A = { cx: o.hx, cy: o.hy, a: 0, vx: 0, vy: 0, va: 0, mode: 'still', glow: 0, flick: 0, ...o };
    r.actors.push(A);
    return A;
  }

  // a word: a copy over the page where it is. ripped, it's two copies, one cut off below the tear and one above it.
  // the box it falls and spins with is the part that has ink in it, not the whole line
  function wordActors(r, k) {
    const b = k.span.getBoundingClientRect(), look = textLook(k.span), col = getComputedStyle(k.span).color;
    const make = (clip, y0, y1) => {
      const node = el('div', `position:absolute;left:0;top:0;margin:0;white-space:pre;height:${b.height}px;`
        + `line-height:${b.height}px;${look};transform-origin:${b.width / 2}px ${(y0 + y1) / 2}px`);
      node.textContent = k.text;
      if (clip) node.style.clipPath = clip;
      r.layer.append(node);
      return actor(r, {
        node, span: k.span, text: k.text, letter: k.letter, col, d: k.d,
        w: b.width, h: Math.max(4, y1 - y0), ox: b.width / 2, oy: (y0 + y1) / 2,
        hx: b.left + b.width / 2, hy: b.top + (y0 + y1) / 2,
      });
    };
    if (!k.tear) return [make(null, b.height * 0.12, b.height * 0.92)];
    const pts = k.tear.map(p => `${(p.x - b.left).toFixed(1)}px ${(p.y - b.top).toFixed(1)}px`);
    const ys = k.tear.map(p => p.y - b.top);
    const top = make(`polygon(-20px -20px,${b.width + 20}px -20px,${[...pts].reverse()})`, b.height * 0.12, Math.max(...ys));
    const bottom = make(`polygon(${pts},${b.width + 20}px ${b.height + 20}px,-20px ${b.height + 20}px)`, Math.min(...ys), b.height * 0.92);
    top.pair = bottom;
    bottom.pair = top;
    top.tear = k.tear;
    return [top, bottom];
  }

  // a whole element, moved in place. its own size, and its transform-origin, so turning it can be made about its middle
  function elementActor(r, e, d) {
    const b = e.getBoundingClientRect(), cs = getComputedStyle(e);
    const [ox, oy] = cs.transformOrigin.split(' ').map(parseFloat);
    // a note's tilt turns everything we add too, so the shifts get turned back by it
    const tilt = cs.rotate && cs.rotate !== 'none' ? (parseFloat(cs.rotate) * Math.PI) / 180 : 0;
    const A = actor(r, {
      node: e, own: true, style0: e.getAttribute('style'), col: cs.color, d, tilt, ox, oy,
      w: e.offsetWidth ?? b.width, h: e.offsetHeight ?? b.height, hx: b.left + b.width / 2, hy: b.top + b.height / 2,
    });
    // the bubble eases its transform, that would lag every frame
    e.style.transition = 'none';
    return A;
  }

  function collect(r) {
    const { W, H, origin } = r;
    const seen = (b, top) => b.width > 1 && b.height > 1 && b.right > 0 && b.left < W && b.bottom > top + 2 && b.top < H;
    const dist = b => Math.hypot(b.left + b.width / 2 - origin.x, b.top + b.height / 2 - origin.y);
    // near the 🤓 things break harder
    const near = d => clamp(1.15 - d / 1300, 0.35, 1);
    const hitAt = d => r.at.snap + d / WAVE + rand(0, 0.05);

    for (const e of document.querySelectorAll(RIGID)) {
      if (e.parentElement.closest(RIGID)) continue;
      const b = e.getBoundingClientRect();
      if (!seen(b, main.contains(e) ? r.mainTop : 0) || b.width > W * 0.8 || getComputedStyle(e).visibility !== 'visible') continue;
      const d = dist(b), q = near(d), A = elementActor(r, e, d), x = Math.random();
      A.q = q;
      A.hit = e === bubble ? r.at.snap : hitAt(d);
      A.fate = e === bubble ? 'launch' : e.matches('.flower canvas') ? 'topple' : x < 0.32 * q ? 'fall' : x < 0.68 * q ? 'hang' : 'crook';
    }

    // the words on screen, measured where they are before anything changes
    const words = [];
    for (const scope of [nav, main]) {
      const top = scope === main ? r.mainTop : 0;
      const walk = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
      for (let n; (n = walk.nextNode());) {
        const parent = n.parentElement;
        if (!/\S/.test(n.data) || parent.closest(SKIP) || parent.closest(RIGID)) continue;
        const cs = getComputedStyle(parent);
        if (cs.visibility !== 'visible') continue;
        const letter = parseFloat(cs.fontSize) >= 21;
        for (const m of n.data.matchAll(letter ? /\S/gu : /\S+/g)) {
          const range = document.createRange();
          range.setStart(n, m.index);
          range.setEnd(n, m.index + m[0].length);
          const rects = range.getClientRects();
          if (rects.length !== 1 || !seen(rects[0], top)) continue;
          const d = dist(rects[0]);
          words.push({ n, start: m.index, end: m.index + m[0].length, text: m[0], letter, b: rects[0], d, score: d * rand(0.7, 1.3) });
        }
      }
    }
    const chosen = words.sort((a, b) => a.score - b.score).slice(0, MAX_WORDS).filter(() => Math.random() > 0.08);

    // the crack rips what it runs through. the tear is jagged down to the pixel
    if (!r.calm) {
      for (const k of chosen) {
        const { left, right, top, bottom, height } = k.b;
        const ys = [left, (left + right) / 2, right].map(x => crackAt(r.crack, x));
        if (!ys.some(y => y > top + height * 0.2 && y < bottom - height * 0.15)) continue;
        k.tear = [];
        for (let x = left - 2; x < right + 3; x += 3) k.tear.push({ x, y: crackAt(r.crack, x) + rand(-1.3, 1.3) });
      }
    }

    // wrap them, a text node at a time. an inline span with no style changes nothing about the layout
    const byNode = new Map();
    for (const k of chosen) (byNode.get(k.n) || byNode.set(k.n, []).get(k.n)).push(k);
    for (const [n, list] of byNode) {
      const parts = [];
      let at = 0;
      for (const k of list.sort((a, b) => a.start - b.start)) {
        if (k.start > at) parts.push(document.createTextNode(n.data.slice(at, k.start)));
        k.span = document.createElement('span');
        k.span.textContent = k.text;
        parts.push(k.span);
        at = k.end;
      }
      if (at < n.data.length) parts.push(document.createTextNode(n.data.slice(at)));
      n.replaceWith(...parts);
      r.wrapped.push({ n, parts });
    }

    for (const k of chosen) {
      const made = wordActors(r, k), q = near(k.d), x = Math.random();
      k.span.style.visibility = 'hidden';
      if (made.length === 2) {
        // the top half stays up crooked or hanging, the bottom half mostly drops
        made[0].fate = x < 0.4 ? 'crook' : x < 0.75 ? 'hang' : 'fall';
        made[1].fate = Math.random() < 0.7 ? 'fall' : 'crook';
        for (const A of made) { A.q = q; A.hit = r.at.snap + rand(0, 0.04); }
        continue;
      }
      const A = made[0];
      A.q = q;
      A.hit = hitAt(k.d);
      A.wrong = k.letter ? LEET[k.text.toLowerCase()] || pick(GLYPHS) : typo(k.text);
      const typoOdds = k.letter ? 0.12 : 0.22;
      A.fate = x < (k.letter ? 0.26 : 0.2) * q ? 'fall'
        : x < (k.letter ? 0.38 : 0.36) * q ? 'hang'
        : x < (k.letter ? 0.38 : 0.36) * q + typoOdds && A.wrong ? 'typo' : 'crook';
    }
    // reduced motion: nothing falls or swings
    if (r.calm) for (const A of r.actors) if (A.fate !== 'typo') A.fate = 'crook';
    // the copies go where their words are straight away, the real elements aren't touched until they move
    for (const A of r.actors) if (!A.own) pose(A);
  }

  // what broke, grouped by where it belongs, top down. one jab of a leg fixes a group
  function group(r) {
    const list = r.actors.filter(A => A.fate).sort((a, b) => a.hy - b.hy);
    let R = 60, out;
    do {
      out = [];
      const left = new Set(list);
      for (const A of list) {
        if (!left.has(A)) continue;
        const c = { members: [], x: 0, y: 0, taken: false };
        for (const B of left) {
          if (Math.hypot(B.hx - A.hx, B.hy - A.hy) > R) continue;
          // the halves of a ripped word always go together
          for (const X of B.pair ? [B, B.pair] : [B]) {
            if (left.delete(X)) c.members.push(X);
          }
        }
        c.x = c.members.reduce((s, B) => s + B.hx, 0) / c.members.length;
        c.y = c.members.reduce((s, B) => s + B.hy, 0) / c.members.length;
        out.push(c);
      }
      R *= 1.25;
    } while (out.length > MAX_TAPS);
    r.clusters = out;
  }

  // ---------- physics

  // where it is on screen. a copy's box is placed directly. the real element is moved by a transform about its own
  // transform-origin, so the shift makes up the difference to turning it about its middle
  function pose(A, jx = 0, jy = 0) {
    const c = Math.cos(A.a), s = Math.sin(A.a);
    if (A.own) {
      const px = A.w / 2 - A.ox, py = A.h / 2 - A.oy;
      let tx = A.cx - A.hx + jx + px - (c * px - s * py), ty = A.cy - A.hy + jy + py - (s * px + c * py);
      if (A.tilt) [tx, ty] = [Math.cos(A.tilt) * tx + Math.sin(A.tilt) * ty, -Math.sin(A.tilt) * tx + Math.cos(A.tilt) * ty];
      A.node.style.transform = `translate(${tx.toFixed(2)}px,${ty.toFixed(2)}px) rotate(${A.a.toFixed(4)}rad)`;
    } else {
      A.node.style.transform = `translate(${(A.cx - A.ox + jx).toFixed(2)}px,${(A.cy - A.oy + jy).toFixed(2)}px) rotate(${A.a.toFixed(4)}rad)`;
    }
  }

  function corners(A) {
    const c = Math.cos(A.a), s = Math.sin(A.a), w = A.w / 2, h = A.h / 2;
    return [[-w, -h], [w, -h], [w, h], [-w, h]].map(([x, y]) => ({ rx: c * x - s * y, ry: s * x + c * y }));
  }

  // a damped spring toward a pose
  function spring(A, tx, ty, ta, k, z, dt) {
    const c = 2 * Math.sqrt(k) * z;
    A.vx += (k * (tx - A.cx) - c * A.vx) * dt;
    A.vy += (k * (ty - A.cy) - c * A.vy) * dt;
    A.va += (k * (ta - A.a) - c * A.va) * dt;
    A.cx += A.vx * dt;
    A.cy += A.vy * dt;
    A.a += A.va * dt;
  }

  // hanging off a pin. gravity turns it about the pin, and it can't swing through the bottom of the screen
  function swing(r, A, dt) {
    const { x, y, rx, ry } = A.pin, k2 = (A.w * A.w + A.h * A.h) / 12 + rx * rx + ry * ry;
    const at = a => [x + Math.cos(a) * rx - Math.sin(a) * ry, y + Math.sin(a) * rx + Math.cos(a) * ry];
    A.va += ((at(A.a)[0] - x) * GRAVITY / k2) * dt;
    A.va *= Math.exp(-dt * (A.mode === 'topple' ? 0.4 : 1.1));
    const before = A.a;
    A.a += A.va * dt;
    [A.cx, A.cy] = at(A.a);
    if (corners(A).some(p => A.cy + p.ry > r.H)) {
      A.a = before;
      A.va *= -0.3;
      [A.cx, A.cy] = at(A.a);
    }
  }

  // falling free, a box that bounces off the bottom and the sides of the screen. each corner that goes through gets
  // an impulse back out, with friction, so it tumbles and settles like a thing would
  function fall(r, A, dt) {
    A.vy += GRAVITY * dt;
    A.cx += A.vx * dt;
    A.cy += A.vy * dt;
    A.a += A.va * dt;
    const I = (A.w * A.w + A.h * A.h) / 12;
    let up = 0, side = 0;
    for (const { rx, ry } of corners(A)) {
      const x = A.cx + rx, y = A.cy + ry;
      if (y > r.H) { up = Math.max(up, y - r.H); contact(A, rx, ry, 0, -1, I); }
      if (x < 0) { side = Math.max(side, -x); contact(A, rx, ry, 1, 0, I); }
      if (x > r.W) { side = Math.min(side, r.W - x); contact(A, rx, ry, -1, 0, I); }
    }
    A.cy -= up;
    A.cx += side;
    // asleep once it's lying still, so it stops being touched every frame
    A.rest = up && Math.hypot(A.vx, A.vy) < 20 && Math.abs(A.va) < 0.3 ? (A.rest || 0) + dt : 0;
    if (A.rest > 0.4) A.sleep = true;
  }
  function contact(A, rx, ry, nx, ny, I) {
    const vn = (A.vx - A.va * ry) * nx + (A.vy + A.va * rx) * ny;
    if (vn >= 0) return;
    const rn = rx * ny - ry * nx, j = (-(vn < -60 ? 1.28 : 1) * vn) / (1 + (rn * rn) / I);
    A.vx += j * nx;
    A.vy += j * ny;
    A.va += (rn * j) / I;
    const tx = -ny, ty = nx, rt = rx * ty - ry * tx;
    const vt = (A.vx - A.va * ry) * tx + (A.vy + A.va * rx) * ty;
    const jt = clamp(-vt / (1 + (rt * rt) / I), -0.6 * j, 0.6 * j);
    A.vx += jt * tx;
    A.vy += jt * ty;
    A.va += (rt * jt) / I;
  }

  // the shock gets to it
  function hit(r, A) {
    const dx = A.hx - r.origin.x, dy = A.hy - r.origin.y, d = Math.hypot(dx, dy) || 1;
    const nx = dx / d, ny = dy / d, q = A.q, size = Math.sqrt(A.w * A.h);
    A.mode = A.fate === 'launch' ? 'fall' : A.fate;
    if (A.fate === 'typo') A.node.textContent = A.wrong;
    if (A.fate === 'launch') {
      // the 🤓 itself pops off
      A.vx = rand(-1, 1) * 220;
      A.vy = -rand(520, 680);
      A.va = rand(-1, 1) * 9;
    } else if (A.fate === 'fall') {
      A.vx = nx * 320 * q + rand(-80, 80);
      A.vy = ny * 240 * q - rand(80, 340) * q;
      A.va = rand(-1, 1) * clamp(110 / size, 0.6, 10);
    } else if (A.fate === 'hang') {
      // still stuck by one top corner
      const side = Math.random() < 0.5 ? -1 : 1;
      A.pin = { x: A.hx + (side * A.w) / 2, y: A.hy - A.h / 2 + rand(0, 3), rx: (-side * A.w) / 2, ry: A.h / 2 };
      A.va = rand(-1, 1) * 2 * q;
      // some give way a bit later
      if (Math.random() < 0.3) A.snapAt = r.t + rand(0.8, 2.4);
    } else if (A.fate === 'topple') {
      // the plant tips over away from the 🤓, about its base
      A.pin = { x: A.hx, y: A.hy + A.h / 2, rx: 0, ry: -A.h / 2 };
      A.va = (A.hx < r.origin.x ? -1 : 1) * rand(0.5, 0.9);
    } else {
      // knocked crooked, it wobbles into a new pose and stays there
      const soft = A.fate === 'typo' ? 0.4 : 1;
      A.dx = rand(-3, 3) * q;
      A.dy = rand(0.04, 0.22) * A.h * soft;
      A.ta = rand(-1, 1) * (A.letter ? 0.34 : A.own ? 0.12 : 0.17) * soft;
      A.vx = nx * 160 * q;
      A.vy = ny * 160 * q - 40;
      A.va = rand(-1, 1) * 5 * q;
    }
    if (r.calm) {
      // reduced motion: straight to where it ends up, no wobble on the way
      A.mode = 'held';
      A.cx = A.hx + A.dx;
      A.cy = A.hy + A.dy;
      A.a = A.ta;
      pose(A);
      return;
    }
    chips(r, A.cx, A.cy, A.own ? 6 : A.letter ? 4 : 2, 200 * q, A.col);
  }

  // jabbed by the spider: everything in the group springs home. the ones that ended up far away get a thread
  function fix(r, c, L) {
    r.thud = Math.max(r.thud, 2.4);
    r.rings.push({ x: c.x, y: c.y, t: r.t });
    sparks(r, c.x, c.y, 16);
    for (const A of c.members) {
      if (A.mode === 'home' || A.mode === 'done') continue;
      A.reel = Math.hypot(A.cx - A.hx, A.cy - A.hy) > 70;
      if (A.reel && L) r.threads.push({ A, L });
      A.mode = 'fix';
      A.sleep = false;
      A.a = wrapAngle(A.a);
      A.glow = 1;
      if (A.fate === 'typo') A.decode = r.t;
    }
  }

  function update(r, A, t, dt) {
    if (A.mode === 'done' || A.mode === 'held') return;
    if (A.mode === 'still') {
      if (t >= A.hit) hit(r, A);
      else if (t < r.at.snap) {
        // the crack's coming, things near it shiver. the 🤓 most
        const p = t / T_CRACK, j = (A.fate === 'launch' ? 3 : 1.4) * p * A.q;
        if (A.d < p * 900) pose(A, rand(-j, j), rand(-j, j));
        return;
      } else return pose(A);
    }
    if (A.mode === 'crook' || A.mode === 'typo') spring(A, A.hx + A.dx, A.hy + A.dy, A.ta, 220, 0.3, dt);
    else if (A.mode === 'hang' || A.mode === 'topple') {
      swing(r, A, dt);
      if (A.snapAt && t > A.snapAt) {
        // it lets go, carrying on the way it was swinging
        A.mode = 'fall';
        A.vx = -A.va * (A.cy - A.pin.y);
        A.vy = A.va * (A.cx - A.pin.x);
        A.va *= 1.5;
        chips(r, A.pin.x, A.pin.y, 3, 120, A.col);
      }
    } else if (A.mode === 'fall') {
      if (A.sleep) return;
      fall(r, A, dt / 2);
      fall(r, A, dt / 2);
    } else if (A.mode === 'fix') {
      spring(A, A.hx, A.hy, 0, A.reel ? 120 : 260, A.reel ? 0.7 : 0.42, dt);
      if (A.decode != null) {
        // the letters scramble and settle on the right ones, left to right
        const p = (t - A.decode) / 0.45, ch = [...A.text];
        A.node.textContent = p >= 1 ? A.text : ch.map((c, i) => (i < p * ch.length ? c : pick(GLYPHS))).join('');
        if (p >= 1) A.decode = null;
      }
      if (Math.hypot(A.cx - A.hx, A.cy - A.hy) < 0.35 && Math.hypot(A.vx, A.vy) < 6 && Math.abs(A.a) < 0.003
        && Math.abs(A.va) < 0.05 && A.decode == null) {
        A.cx = A.hx;
        A.cy = A.hy;
        A.a = 0;
        A.mode = 'home';
      }
    }
    if (A.glow > 0) {
      A.glow = Math.max(0, A.glow - dt * 1.6);
      A.node.style.filter = A.glow ? `drop-shadow(0 0 ${(6 * A.glow).toFixed(1)}px color-mix(in srgb,${C.tech} ${Math.round(A.glow * 90)}%,transparent))` : '';
    }
    if (A.mode === 'home') {
      // back where it belongs. a ripped one waits for its other half, then they're welded
      if (A.pair && A.pair.mode !== 'home') return pose(A);
      if (A.pair) {
        const top = A.tear ? A : A.pair;
        r.welds.push({ pts: top.tear, t });
        for (let i = 0; i < top.tear.length; i += 4) sparks(r, top.tear[i].x, top.tear[i].y, 1);
      }
      for (const B of A.pair ? [A, A.pair] : [A]) handBack(B);
      return;
    }
    pose(A, A.flick ? rand(-5, 5) : 0, 0);
  }

  // the real one shows again
  function handBack(A) {
    A.mode = 'done';
    if (A.own) release(A.node, A.style0);
    else {
      A.node.remove();
      A.span.style.visibility = '';
    }
  }

  // broken things glitch now and then, a colour split and a jump to the side. a typo flickers to garbage
  function flicker(r, t) {
    for (const A of r.actors) {
      if (A.flick && --A.flick === 0 && A.mode !== 'done') {
        if (!A.glow) A.node.style.filter = '';
        if (A.mode === 'typo') A.node.textContent = A.wrong;
      }
    }
    if (Math.random() > 0.4) return;
    const A = pick(r.actors);
    const live = t < r.at.snap ? A?.d < (t / T_CRACK) * 900 && A.mode === 'still' : BROKEN.has(A?.mode);
    if (!live || A.flick) return;
    A.flick = 2 + Math.floor(Math.random() * 4);
    A.node.style.filter = 'drop-shadow(2px 0 rgba(255,40,90,.7)) drop-shadow(-2px 0 rgba(40,240,255,.7))';
    if (A.mode === 'typo') A.node.textContent = glitched(A.wrong);
  }

  // ---------- particles

  // bits off broken things, they drop and bounce on the bottom of the screen
  function chips(r, x, y, n, power, col) {
    for (let i = 0; i < n; i++) {
      r.parts.push({ x, y, vx: rand(-1, 1) * power, vy: rand(-1.4, 0.3) * power, s: rand(1.4, 3.4), col, life: rand(1, 2.2) });
    }
  }
  // off a jab, they fly up off the page and fall back
  function sparks(r, x, y, n) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2), v = rand(60, 260);
      r.parts.push({ x, y, z: 2, vx: Math.cos(a) * v, vy: Math.sin(a) * v, vz: rand(120, 420), spark: true, life: rand(0.25, 0.6), col: Math.random() < 0.3 ? C.accent : C.tech });
    }
  }

  // ---------- the spider

  // its size goes with the screen
  function dims(W, H) {
    const k = clamp(Math.min(W, H * 1.4) / 900, 0.6, 1), deg = Math.PI / 180;
    return {
      k, thigh: 88 * k, shin: 116 * k, z: 46 * k, lag: 48 * k, lift: 30 * k, speed: 320 * k, reach: 190 * k, stepTime: 0.15,
      // hips on the body, ahead and out to the side. feet at rest, at an angle from straight ahead and a distance
      hips: [[17, 11], [9, 15], [0, 15], [-9, 12]].map(([u, v]) => [u * k, v * k]),
      rests: [[40, 152], [80, 140], [113, 136], [146, 150]].map(([a, d]) => [Math.cos(a * deg) * d * k, Math.sin(a * deg) * d * k]),
    };
  }

  function makeSpider(r) {
    const D = dims(r.W, r.H);
    const s = { D, x: r.W / 2 + rand(-80, 80), y: -230 * D.k, z: D.z, h: Math.PI / 2, vx: 0, vy: 0, t: 0, glitch: 0.4, legs: [] };
    for (let i = 0; i < 4; i++) {
      for (const side of [-1, 1]) {
        const L = { i, side, group: (i + (side > 0)) % 2, step: null, task: null, L1: D.thigh * LEN[i], L2: D.shin * LEN[i] };
        L.f = restOf(s, L);
        s.legs.push(L);
      }
    }
    return s;
  }

  // the body's own frame to the page: u ahead, v to its right, z up off the page
  function local(s, u, v, z) {
    const c = Math.cos(s.h), n = Math.sin(s.h);
    return { x: s.x + c * u - n * v, y: s.y + n * u + c * v, z };
  }
  const hipOf = (s, L) => local(s, s.D.hips[L.i][0], s.D.hips[L.i][1] * L.side, s.z);
  const restOf = (s, L) => local(s, s.D.rests[L.i][0], s.D.rests[L.i][1] * L.side, 0);

  // two bone ik in 3d. the knee is where the thigh and the shin both reach, bent up off the page, which is what
  // makes the legs arch like a harvestman's. a foot out of reach gets as close as the leg allows
  function knee3(h, f, L1, L2) {
    let dx = f.x - h.x, dy = f.y - h.y, dz = f.z - h.z;
    const d = Math.hypot(dx, dy, dz) || 1, reach = clamp(d, Math.abs(L1 - L2) + 1, L1 + L2 - 0.5);
    dx /= d; dy /= d; dz /= d;
    let wx = -dz * dx, wy = -dz * dy, wz = 1 - dz * dz;
    const wl = Math.hypot(wx, wy, wz) || 1;
    wx /= wl; wy /= wl; wz /= wl;
    const a = Math.acos(clamp((L1 * L1 + reach * reach - L2 * L2) / (2 * L1 * reach), -1, 1));
    const ca = Math.cos(a) * L1, sa = Math.sin(a) * L1;
    return {
      knee: { x: h.x + dx * ca + wx * sa, y: h.y + dy * ca + wy * sa, z: h.z + dz * ca + wz * sa },
      foot: { x: h.x + dx * reach, y: h.y + dy * reach, z: h.z + dz * reach },
    };
  }

  function updateSpider(r, dt) {
    const s = r.spider, D = s.D;
    s.t += dt;
    const todo = r.clusters.filter(c => !c.taken);
    let busy = s.legs.filter(L => L.task).length;

    // where to: the nearest thing still broken in the top band of what's left, standing off it by half a leg.
    // nothing left, off the bottom
    let goal = { x: s.x, y: s.y };
    if (todo.length) {
      if (!s.focus || s.focus.taken) {
        const top = Math.min(...todo.map(c => c.y)), d = c => Math.hypot(c.x - s.x, c.y - s.y);
        s.focus = todo.filter(c => c.y < top + 160).reduce((a, c) => (d(c) < d(a) ? c : a));
      }
      const dx = s.focus.x - s.x, dy = s.focus.y - s.y, d = Math.hypot(dx, dy) || 1;
      // not off the top of the screen though, it reaches up for things up there
      goal = { x: s.focus.x - (dx / d) * D.reach * 0.5, y: Math.max(80 * D.k, s.focus.y - (dy / d) * D.reach * 0.5) };
    } else if (!busy) goal = { x: s.x, y: r.H + 600 * D.k };

    // walk there, slowly while a leg is busy, turning to face the way it goes
    const gx = goal.x - s.x, gy = goal.y - s.y, gd = Math.hypot(gx, gy);
    const sp = Math.min(D.speed * (busy ? 0.5 : 1), gd * 2.4);
    s.vx += ((gd > 0.5 ? (gx / gd) * sp : 0) - s.vx) * Math.min(1, dt * 3);
    s.vy += ((gd > 0.5 ? (gy / gd) * sp : 0) - s.vy) * Math.min(1, dt * 3);
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    const v = Math.hypot(s.vx, s.vy);
    if (v > 35) s.h += wrapAngle(Math.atan2(s.vy, s.vx) - s.h) * Math.min(1, dt * 2.6);
    s.z = D.z + Math.sin(s.t * 9) * 2.2 * D.k * Math.min(1, v / 80);

    // anything a free front leg can reach gets jabbed, three at a time
    for (const c of todo) {
      if (busy >= 3) break;
      let best = null, bd = D.reach * 0.92;
      for (const L of s.legs) {
        if (L.task || L.step || L.i > 1) continue;
        const h = hipOf(s, L), d = Math.hypot(c.x - h.x, c.y - h.y);
        if (d < bd) { best = L; bd = d; }
      }
      if (!best) continue;
      best.task = { c, phase: 0, t: 0, from: { ...best.f } };
      c.taken = true;
      busy++;
    }

    // the walk: steps under way carry on, then a foot left too far behind its resting spot steps, one group of four
    // at a time unless it's being dragged
    const stepping = [0, 0];
    for (const L of s.legs) {
      if (L.task) { work(r, s, L, dt); continue; }
      if (!L.step) continue;
      L.step.t = Math.min(1, L.step.t + dt / D.stepTime);
      const e = ease(L.step.t), { from, to } = L.step;
      L.f = { x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e, z: Math.sin(Math.PI * L.step.t) * D.lift };
      if (L.step.t < 1) { stepping[L.group]++; continue; }
      L.step = null;
      r.thud = Math.max(r.thud, 0.7);
      if (L.f.y > 0 && L.f.y < r.H) chips(r, L.f.x, L.f.y, 2, 50, C.grey);
    }
    for (const L of s.legs) {
      if (L.step || L.task) continue;
      const to = restOf(s, L), dx = to.x - L.f.x, dy = to.y - L.f.y, far = Math.hypot(dx, dy);
      if (far < D.lag || (stepping[1 - L.group] && far < D.lag * 2.2)) continue;
      const k = (0.65 * D.lag) / far;
      L.step = { t: 0, from: { ...L.f }, to: { x: to.x + dx * k, y: to.y + dy * k, z: 0 } };
      stepping[L.group]++;
    }

    // walking over the crack zips it shut, out both ways from under it
    if (r.crack && !r.heal && s.y > crackAt(r.crack, s.x) - 30) {
      const p = r.crack.points;
      let i = 0;
      p.forEach((q, j) => { if (Math.abs(q.x - s.x) < Math.abs(p[i].x - s.x)) i = j; });
      r.heal = { i, t: r.t, end: r.t + Math.max(i, p.length - i) * HEAL_STEP + 0.8 };
    }

    // now and then it glitches for a moment
    s.glitch -= dt;
    if (s.glitch <= 0 && Math.random() < dt * 0.9) {
      s.glitch = rand(0.06, 0.22);
      s.asciiLegs = Math.random() < 0.5;
    }
    if (s.y > r.H + 230 * D.k) s.gone = true;
  }

  // a leg fixing something: up and over it, a jab, holding there while it all comes back, then back to walking
  function work(r, s, L, dt) {
    const T = L.task, c = T.c, k = s.D.k, hover = 64 * k;
    const next = phase => { T.phase = phase; T.t = 0; T.from = { ...L.f }; };
    T.t += dt;
    if (T.phase === 0) {
      const p = ease(T.t / 0.3);
      L.f = {
        x: T.from.x + (c.x - T.from.x) * p, y: T.from.y + (c.y - T.from.y) * p,
        z: T.from.z + (hover - T.from.z) * p + Math.sin(Math.PI * p) * 24 * k,
      };
      if (T.t >= 0.3) next(1);
    } else if (T.phase === 1) {
      L.f = { x: c.x, y: c.y, z: hover * (1 - clamp(T.t / 0.075, 0, 1) ** 2) };
      if (T.t >= 0.075) { next(2); fix(r, c, L); }
    } else if (T.phase === 2) {
      L.f = { x: c.x + rand(-0.8, 0.8), y: c.y + rand(-0.8, 0.8), z: 0 };
      if (Math.random() < dt * 30) sparks(r, c.x, c.y, 1);
      // until it's nearly all back, it settles on its own after
      if ((T.t > 0.16 && c.members.every(A => A.mode !== 'fix' || Math.hypot(A.cx - A.hx, A.cy - A.hy) < 18)) || T.t > 0.7) next(3);
    } else {
      const to = restOf(s, L), p = ease(T.t / 0.22);
      L.f = { x: T.from.x + (to.x - T.from.x) * p, y: T.from.y + (to.y - T.from.y) * p, z: Math.sin(Math.PI * p) * 34 * k };
      if (T.t >= 0.22) { L.task = null; L.f.z = 0; }
    }
  }

  // ---------- drawing the spider

  function convexHull(pts) {
    pts.sort((a, b) => a.x - b.x || a.y - b.y);
    const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
    const half = list => {
      const out = [];
      for (const p of list) {
        while (out.length > 1 && cross(out.at(-2), out.at(-1), p) <= 0) out.pop();
        out.push(p);
      }
      return out.slice(0, -1);
    };
    return [...half(pts), ...half([...pts].reverse())];
  }

  // a body part, an ellipsoid of wire: its outline filled dark so it hides what's behind, and rings and ribs on the
  // side facing you
  function ellipsoid(g, s, E, tint) {
    const ch = Math.cos(s.h), sh = Math.sin(s.h), k = s.D.k;
    const at = (u, v, z) => ({ x: E.o.x + ch * u - sh * v, y: E.o.y + sh * u + ch * v, z: E.o.z + z });
    const surf = (th, ph) => [E.a * Math.cos(ph) * Math.cos(th), E.b * Math.cos(ph) * Math.sin(th), E.c * Math.sin(ph)];
    // the normal there, against the way the camera looks
    const faces = (u, v, z) => ((sh * u) / (E.a * E.a) + (ch * v) / (E.b * E.b)) * PY + z / (E.c * E.c) > 0;

    const pts = [];
    for (let ph = -1.2; ph < 1.7; ph += 0.4) for (let th = 0; th < 6.3; th += 0.5) pts.push(P(at(...surf(th, ph))));
    const out = convexHull(pts);
    g.beginPath();
    out.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)));
    g.closePath();
    if (!tint) { g.fillStyle = VOID_COL; g.fill(); }
    g.strokeStyle = tint || C.text;
    g.lineWidth = 1.3;
    g.stroke();

    g.strokeStyle = tint || C.grey;
    g.lineWidth = 0.8;
    const wire = (n, f) => {
      g.beginPath();
      let on = false;
      for (let i = 0; i <= n; i++) {
        const [u, v, z] = surf(...f(i / n)), q = P(at(u, v, z));
        if (!faces(u, v, z)) { on = false; continue; }
        on ? g.lineTo(q.x, q.y) : g.moveTo(q.x, q.y);
        on = true;
      }
      g.stroke();
    };
    for (const ph of [0.15, 0.6, 1.05]) wire(28, p => [p * Math.PI * 2, ph]);
    for (let th = 0; th < 6.2; th += Math.PI / 3) wire(10, p => [th, -0.3 + p * 1.87]);

    if (E.panel) {
      // the ascii on its back, on the surface so it curves with it
      g.font = `bold ${Math.round(10.5 * k + 2)}px ${MONO}`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      if (!s.art || Math.random() < 0.12) {
        s.art = PANEL.map(row => [...row].map(c => (Math.random() < 0.1 ? pick(GLYPHS) : c)));
      }
      s.art.forEach((row, ri) => row.forEach((c, ci) => {
        const u = (0.5 - ri * 0.25) * E.a, v = (-0.42 + ci * 0.28) * E.b;
        const z = E.c * Math.sqrt(Math.max(0, 1 - (u / E.a) ** 2 - (v / E.b) ** 2)), q = P(at(u, v, z));
        g.fillStyle = tint || (c === '%' ? C.accent : C.tech);
        g.fillText(c, q.x, q.y);
      }));
    }
    if (E.head) {
      if (!tint) { g.shadowColor = C.accent; g.shadowBlur = 8; }
      g.fillStyle = tint || C.accent;
      for (const [u, v, z, size] of EYES) {
        for (const side of [-1, 1]) {
          const lu = u * E.a, lv = v * side * E.b, lz = z * E.c;
          if (!faces(lu, lv, lz)) continue;
          const q = P(at(lu, lv, lz));
          g.beginPath();
          g.arc(q.x, q.y, size * k, 0, 7);
          g.fill();
        }
      }
      g.shadowBlur = 0;
      // fangs, twitching
      const tw = Math.sin(s.t * 23) * 0.06;
      g.strokeStyle = tint || C.soft;
      g.lineWidth = 1.6;
      for (const side of [-1, 1]) {
        line(g, P(at(0.85 * E.a, side * 0.3 * E.b, -0.35 * E.c)), P(at(1.45 * E.a, side * (0.2 + tw) * E.b, -1.5 * E.c)));
      }
    }
  }

  // the thigh is a truss, two rails and a zigzag between them
  function truss(g, a, b, hw, k, tint) {
    const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1, nx = (-dy / len) * hw, ny = (dx / len) * hw;
    if (!tint) {
      g.fillStyle = 'rgba(9,9,12,.6)';
      g.beginPath();
      g.moveTo(a.x + nx, a.y + ny); g.lineTo(b.x + nx, b.y + ny); g.lineTo(b.x - nx, b.y - ny); g.lineTo(a.x - nx, a.y - ny);
      g.fill();
    }
    g.strokeStyle = tint || C.soft;
    g.lineWidth = 1.5;
    line(g, { x: a.x + nx, y: a.y + ny }, { x: b.x + nx, y: b.y + ny });
    line(g, { x: a.x - nx, y: a.y - ny }, { x: b.x - nx, y: b.y - ny });
    g.strokeStyle = tint || C.grey;
    g.lineWidth = 0.9;
    const n = Math.max(2, Math.round(len / (7 * k)));
    g.beginPath();
    for (let i = 0; i <= n; i++) {
      const p = i / n, side = i % 2 ? 1 : -1;
      const x = a.x + dx * p + nx * side, y = a.y + dy * p + ny * side;
      i ? g.lineTo(x, y) : g.moveTo(x, y);
    }
    g.stroke();
  }

  // a glitch draws a bone in characters instead, picked by its slope
  function glyphLine(g, a, b, col) {
    const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy);
    const ang = ((Math.atan2(dy, dx) % Math.PI) + Math.PI) % Math.PI;
    const c = ang < 0.39 || ang > 2.75 ? '-' : ang < 1.18 ? '\\' : ang < 1.96 ? '|' : '/';
    g.fillStyle = col;
    for (let d = 0; d < len; d += 8) g.fillText(Math.random() < 0.1 ? pick(GLYPHS) : c, a.x + (dx * d) / len, a.y + (dy * d) / len);
  }

  function drawLeg(g, s, L, tint) {
    const k = s.D.k, { h, kn, f } = L.g, a = P(h), b = P(kn), c = P(f);
    if (s.glitch > 0 && s.asciiLegs) {
      g.font = `${Math.round(11 * k + 2)}px ${MONO}`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      glyphLine(g, a, b, tint || C.tech);
      glyphLine(g, b, c, tint || C.tech);
      return;
    }
    truss(g, a, b, 2.8 * k, k, tint);
    // the shin, tapering to a point, with a slot down the top of it
    const dx = c.x - b.x, dy = c.y - b.y, len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len;
    g.fillStyle = tint || C.soft;
    g.beginPath();
    g.moveTo(b.x + nx * 3.2 * k, b.y + ny * 3.2 * k);
    g.lineTo(c.x + nx * 0.7, c.y + ny * 0.7);
    g.lineTo(c.x - nx * 0.7, c.y - ny * 0.7);
    g.lineTo(b.x - nx * 3.2 * k, b.y - ny * 3.2 * k);
    g.fill();
    if (!tint) {
      g.strokeStyle = VOID_COL;
      g.lineWidth = 0.9;
      line(g, { x: b.x + dx * 0.15, y: b.y + dy * 0.15 }, { x: b.x + dx * 0.55, y: b.y + dy * 0.55 });
    }
    // the knee, a joint
    g.beginPath();
    g.arc(b.x, b.y, 3.6 * k, 0, 7);
    if (!tint) { g.fillStyle = VOID_COL; g.fill(); }
    g.strokeStyle = tint || C.text;
    g.lineWidth = 1.2;
    g.stroke();
    g.fillStyle = tint || C.text;
    g.fillRect(c.x - 1, c.y - 1, 2, 2);
  }

  function drawSpider(g, s, ox, tint) {
    const k = s.D.k;
    g.save();
    g.translate(ox, 0);
    g.lineCap = g.lineJoin = 'round';
    // the legs on the far side first, then the body, then the near legs over it
    for (const L of s.legs) if (L.g.f.y < s.y) drawLeg(g, s, L, tint);
    const parts = [
      { u: -50 * k, z: 12 * k, a: 54 * k, b: 39 * k, c: 32 * k, panel: true },
      { u: 10 * k, z: 0, a: 30 * k, b: 26 * k, c: 19 * k },
      { u: 40 * k, z: -2 * k, a: 15 * k, b: 16 * k, c: 12 * k, head: true },
    ].map(E => ({ ...E, o: local(s, E.u, 0, s.z + E.z) }));
    parts.sort((p, q) => p.o.y * PY + p.o.z - (q.o.y * PY + q.o.z));
    for (const E of parts) ellipsoid(g, s, E, tint);
    for (const L of s.legs) if (L.g.f.y >= s.y) drawLeg(g, s, L, tint);
    g.restore();
  }

  // the shadows go on the page, under everything of the spider
  function drawShadow(g, s) {
    const k = s.D.k;
    g.save();
    g.strokeStyle = 'rgba(0,0,0,.4)';
    g.lineCap = g.lineJoin = 'round';
    for (const L of s.legs) {
      const a = SH(L.g.h), b = SH(L.g.kn), c = SH(L.g.f);
      g.lineWidth = 4 * k;
      line(g, a, b);
      g.lineWidth = 2.4 * k;
      line(g, b, c);
    }
    const o = SH(local(s, -16 * k, 0, s.z));
    g.translate(o.x, o.y);
    g.rotate(s.h);
    for (const [rx, ry, al] of [[78, 42, 0.14], [62, 32, 0.2]]) {
      g.fillStyle = `rgba(0,0,0,${al})`;
      g.beginPath();
      g.ellipse(0, 0, rx * k, ry * k, 0, 0, 7);
      g.fill();
    }
    g.restore();
  }

  // a glitch tears a few strips of it sideways
  function tear(r, s) {
    const g = r.ctx, d = r.dpr, k = s.D.k;
    for (let i = 0; i < 3; i++) {
      const y = s.y + rand(-140, 110) * k, h = rand(3, 14), x = Math.max(0, s.x - 230 * k), w = Math.min(r.W - x, 460 * k);
      if (y < 0 || y + h > r.H || w <= 0) continue;
      g.drawImage(r.canvas, x * d, y * d, w * d, h * d, x + rand(-16, 16), y, w, h);
    }
  }

  // ---------- the run

  function start() {
    if (run) return;
    const W = innerWidth, H = innerHeight;
    const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const b = bubble.getBoundingClientRect(), origin = { x: b.left + b.width / 2, y: b.top + b.height / 2 };
    const h1 = document.querySelector('#s1 h1')?.getBoundingClientRect();
    const aim = h1 && h1.bottom > 0 && h1.top < H ? h1.top + h1.height * 0.55 : origin.y;

    // the overlay: the stand-ins for the words, and a canvas over them for everything drawn. it takes every click, so
    // the page underneath can't be used mid break, and a click skips. the wall canvas sits behind the page, the crack
    // is in the wall
    const root = el('div', 'position:fixed;inset:0;z-index:50;overflow:hidden;touch-action:none');
    const layer = el('div', 'position:absolute;inset:0');
    const canvas = el('canvas', 'position:absolute;inset:0;width:100%;height:100%');
    const wall = el('canvas', 'position:fixed;inset:0;width:100%;height:100%;z-index:-1;pointer-events:none');
    root.setAttribute('aria-hidden', 'true');
    root.append(layer, canvas);
    const dpr = devicePixelRatio || 1;
    for (const c of [canvas, wall]) { c.width = W * dpr; c.height = H * dpr; }
    const bg = document.getElementById('bg');

    run = {
      W, H, calm, origin, root, layer, canvas, wall, dpr, ctx: canvas.getContext('2d'), wctx: wall.getContext('2d'),
      crack: calm ? null : crackLine(origin, W, H, aim), at: { snap: calm ? 0 : T_CRACK, spider: T_CRACK + T_SPIDER },
      actors: [], wrapped: [], clusters: [], parts: [], rings: [], threads: [], welds: [], spider: null, heal: null,
      thud: 0, t: 0, phase: { x: rand(0, 9), y: rand(0, 9) }, t0: performance.now(), last: performance.now(),
      scroll: main.scrollTop, mainTop: main.getBoundingClientRect().top,
      // the camera shake moves these, they get their own style back after
      shaken: [nav, main, bg].filter(Boolean).map(e => [e, e.getAttribute('style')]),
    };
    collect(run);
    group(run);
    if (calm) for (const A of run.actors) hit(run, A);
    document.body.append(root);
    (bg || document.body.firstChild).after(wall);
    root.addEventListener('pointerdown', finish);
    addEventListener('keydown', onKey, true);
    addEventListener('resize', onResize);
    frame = requestAnimationFrame(tick);
  }

  // everything was measured for this width. a phone's bars sliding in and out only change the height, that's fine
  const onResize = () => run && innerWidth !== run.W && finish();

  // esc skips. the keys that would scroll the page under it do nothing
  function onKey(e) {
    if (e.key === 'Escape') return finish();
    if ([' ', 'ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End'].includes(e.key)) e.preventDefault();
  }

  function shake(r, t) {
    let amp = r.thud;
    if (!r.calm) {
      const after = t - r.at.snap;
      amp += after < 0 ? 0.6 + 3.4 * (t / T_CRACK) ** 2 : KICK * Math.exp(-after * 5.5) + 2.5 * Math.exp(-after * 1.4);
    }
    const n = (a, b, p) => Math.sin(t * a + p) * 0.6 + Math.sin(t * b + p * 1.7) * 0.4;
    return { x: amp * n(53, 31, r.phase.x), y: amp * n(47, 29, r.phase.y) };
  }

  function tick(now) {
    const r = run, dt = Math.min(1 / 30, (now - r.last) / 1000);
    r.last = now;
    const t = (r.t = (now - r.t0) / 1000);
    if (main.scrollTop !== r.scroll) main.scrollTo({ top: r.scroll, behavior: 'instant' });
    r.thud *= Math.exp(-dt * 10);

    const sh = shake(r, t), tf = `translate(${sh.x.toFixed(2)}px,${sh.y.toFixed(2)}px)`;
    for (const [e] of r.shaken) e.style.transform = tf;
    r.root.style.transform = r.wall.style.transform = tf;

    if (!r.calm && t >= r.at.snap && !r.snapped) {
      // the snap. the crack opens and spits bits of wall
      r.snapped = true;
      r.crack.points.forEach((p, i) => i % 3 || chips(r, p.x, p.y, 2, 240, C.grey));
    }
    for (const A of r.actors) update(r, A, t, dt);
    if (!r.calm) flicker(r, t);

    if (r.calm) {
      // one group at a time, straight back
      r.clusters.forEach((c, i) => {
        if (c.taken || t < 0.9 + i * 0.16) return;
        c.taken = true;
        for (const A of c.members) { if (A.fate === 'typo') A.node.textContent = A.text; handBack(A); }
      });
    } else if (t >= r.at.spider) {
      r.spider ||= makeSpider(r);
      if (!r.spider.gone) updateSpider(r, dt);
      // whatever's somehow left when it's gone goes back on its own
      else for (const c of r.clusters) if (!c.taken) { c.taken = true; fix(r, c, null); }
    }

    drawWall(r, t);
    drawFx(r, t, dt);

    const settled = r.actors.every(A => A.mode === 'done');
    if (r.calm ? settled : (r.spider?.gone && settled && (!r.heal || t > r.heal.end)) || t > r.at.spider + 45) return finish();
    frame = requestAnimationFrame(tick);
  }

  // the crack, behind the page. a bright hairline while it runs, then a dark gap with a lit bottom lip, widest at the
  // 🤓. the spider zips it shut, stitch by stitch
  function drawWall(r, t) {
    if (r.calm || (t > r.at.snap + 0.4 && !(r.heal && t < r.heal.end + 0.05))) return;
    const g = r.wctx, { points: pts, origin: o, branches } = r.crack;
    g.setTransform(r.dpr, 0, 0, r.dpr, 0, 0);
    g.clearRect(0, 0, r.W, r.H);
    g.lineCap = g.lineJoin = 'round';
    const path = (list, from, to) => {
      g.beginPath();
      for (let i = from; i <= to; i++) i === from ? g.moveTo(list[i].x, list[i].y) : g.lineTo(list[i].x, list[i].y);
    };
    if (t < r.at.snap) {
      const reach = Math.ceil(ease(t / T_CRACK) * Math.max(o, pts.length - o));
      const from = Math.max(0, o - reach), to = Math.min(pts.length - 1, o + reach);
      g.strokeStyle = 'rgba(255,255,255,.85)';
      g.shadowColor = 'rgba(255,255,255,.7)';
      g.shadowBlur = 6;
      g.lineWidth = 1.3;
      path(pts, from, to);
      g.stroke();
      g.lineWidth = 0.7;
      for (const b of branches) if (b.at >= from && b.at <= to) { path(b.path, 0, b.path.length - 1); g.stroke(); }
      return;
    }
    const closeAt = i => (r.heal ? r.heal.t + Math.abs(i - r.heal.i) * HEAL_STEP : Infinity);
    const open = i => ease((t - r.at.snap) / 0.18) * (1 - ease((t - closeAt(i)) / 0.18));
    const wide = i => open(i) * (2 + 7 * Math.exp(-Math.abs(i - o) / 14));
    // the branches first, scratched in
    for (const b of branches) {
      const k = open(b.at);
      if (k < 0.02) continue;
      g.globalAlpha = k;
      g.strokeStyle = 'rgba(255,255,255,.08)';
      g.lineWidth = 1;
      g.save();
      g.translate(0, 1);
      path(b.path, 0, b.path.length - 1);
      g.stroke();
      g.restore();
      g.strokeStyle = 'rgba(0,0,0,.6)';
      path(b.path, 0, b.path.length - 1);
      g.stroke();
    }
    g.globalAlpha = 1;
    const top = pts.map((p, i) => ({ x: p.x, y: p.y - wide(i) * 0.4 })), bottom = pts.map((p, i) => ({ x: p.x, y: p.y + wide(i) * 0.6 }));
    g.beginPath();
    top.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)));
    for (let i = bottom.length - 1; i >= 0; i--) g.lineTo(bottom[i].x, bottom[i].y);
    g.fillStyle = VOID_COL;
    g.fill();
    // its edges, a bit at a time so the closed parts fade out with it
    g.lineWidth = 1;
    for (let i = 1; i < pts.length; i++) {
      g.globalAlpha = Math.min(open(i - 1), open(i));
      if (g.globalAlpha < 0.02) continue;
      g.strokeStyle = 'rgba(0,0,0,.55)';
      path(top, i - 1, i);
      g.stroke();
      g.strokeStyle = 'rgba(255,255,255,.16)';
      path(bottom, i - 1, i);
      g.stroke();
    }
    g.globalAlpha = 1;
    // the snap's flash along it
    const flash = 1 - (t - r.at.snap) / 0.3;
    if (flash > 0) {
      g.strokeStyle = `rgba(255,255,255,${(flash * 0.9).toFixed(3)})`;
      g.shadowColor = 'rgba(255,255,255,.8)';
      g.shadowBlur = 10;
      g.lineWidth = 1.6;
      path(pts, 0, pts.length - 1);
      g.stroke();
      g.shadowBlur = 0;
    }
    if (!r.heal) return;
    // the stitches where it's just closed, and the zip's bright front
    g.font = `11px ${MONO}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    pts.forEach((p, i) => {
      const age = t - closeAt(i);
      if (age < 0 || age > 0.8) return;
      g.globalAlpha = 1 - age / 0.8;
      g.fillStyle = C.tech;
      if (i % 2 === 0) g.fillText('x', p.x, p.y);
      if (age < 0.08) {
        g.shadowColor = C.tech;
        g.shadowBlur = 10;
        g.fillRect(p.x - 2, p.y - 2, 4, 4);
        g.shadowBlur = 0;
      }
    });
    g.globalAlpha = 1;
  }

  function drawFx(r, t, dt) {
    const g = r.ctx, s = r.spider && !r.spider.gone ? r.spider : null;
    g.setTransform(r.dpr, 0, 0, r.dpr, 0, 0);
    g.clearRect(0, 0, r.W, r.H);
    g.lineCap = g.lineJoin = 'round';
    if (s) {
      for (const L of s.legs) {
        const { knee, foot } = knee3(hipOf(s, L), L.f, L.L1, L.L2);
        L.g = { h: hipOf(s, L), kn: knee, f: foot };
      }
      drawShadow(g, s);
    }

    // jabs: rings on the page where a foot came down
    r.rings = r.rings.filter(q => t - q.t < 0.5);
    for (const q of r.rings) {
      const p = (t - q.t) / 0.5;
      g.strokeStyle = C.tech;
      g.lineWidth = 1.4;
      for (const [k, d] of [[1, 0], [0.6, 0.1]]) {
        g.globalAlpha = Math.max(0, 1 - p - d) * 0.9;
        g.beginPath();
        g.arc(q.x, q.y, 4 + ease(p) * 46 * k, 0, 7);
        g.stroke();
      }
    }
    g.globalAlpha = 1;

    // threads, from the foot to what it's reeling in, with a bead running up them
    r.threads = r.threads.filter(q => q.A.mode === 'fix');
    for (const { A, L } of r.threads) {
      const a = P(L.g?.f || L.f), b = { x: A.cx, y: A.cy }, m = { x: (a.x + b.x) / 2 + (b.y - a.y) * 0.06, y: (a.y + b.y) / 2 + 14 };
      g.strokeStyle = 'rgba(235,231,223,.7)';
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(a.x, a.y);
      g.quadraticCurveTo(m.x, m.y, b.x, b.y);
      g.stroke();
      const p = 1 - ((t * 2.5) % 1), x = (1 - p) ** 2 * a.x + 2 * (1 - p) * p * m.x + p * p * b.x, y = (1 - p) ** 2 * a.y + 2 * (1 - p) * p * m.y + p * p * b.y;
      g.fillStyle = C.text;
      g.fillRect(x - 1.5, y - 1.5, 3, 3);
    }

    // bits, and sparks
    r.parts = r.parts.filter(q => (q.life -= dt) > 0);
    for (const q of r.parts) {
      g.globalAlpha = Math.min(1, q.life * 2.5);
      if (q.spark) {
        const before = P(q);
        q.vz -= 1100 * dt;
        q.x += q.vx * dt;
        q.y += q.vy * dt;
        q.z += q.vz * dt;
        if (q.z < 0) { q.z = 0; q.vz *= -0.4; q.vx *= 0.6; q.vy *= 0.6; }
        g.strokeStyle = q.col;
        g.lineWidth = 1.4;
        line(g, before, P(q));
        continue;
      }
      q.vy += GRAVITY * 0.8 * dt;
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      if (q.y > r.H - q.s) { q.y = r.H - q.s; q.vy *= -0.3; q.vx *= 0.6; }
      g.fillStyle = q.col;
      g.fillRect(q.x, q.y, q.s, q.s);
    }
    g.globalAlpha = 1;

    // a ripped word coming back together glows along the tear
    r.welds = r.welds.filter(w => t - w.t < 0.6);
    for (const w of r.welds) {
      g.globalAlpha = 1 - (t - w.t) / 0.6;
      g.strokeStyle = C.tech;
      g.shadowColor = C.tech;
      g.shadowBlur = 8;
      g.lineWidth = 1.6;
      g.beginPath();
      w.pts.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)));
      g.stroke();
      g.shadowBlur = 0;
    }
    g.globalAlpha = 1;

    if (!s) return;
    if (s.glitch > 0) {
      g.globalCompositeOperation = 'lighter';
      drawSpider(g, s, -3, 'rgba(255,50,90,.6)');
      drawSpider(g, s, 3, 'rgba(50,240,255,.6)');
      g.globalCompositeOperation = 'source-over';
    }
    drawSpider(g, s, 0, null);
    if (s.glitch > 0) tear(r, s);
  }

  // the page as it was, everything gone. skipping comes here too
  function finish() {
    if (!run) return;
    const r = run;
    run = null;
    cancelAnimationFrame(frame);
    for (const A of r.actors) if (A.own && A.mode !== 'done') release(A.node, A.style0);
    for (const { n, parts } of r.wrapped) {
      if (!parts[0].isConnected) continue;
      parts[0].before(n);
      for (const p of parts) p.remove();
    }
    for (const [e, style] of r.shaken) restoreStyle(e, style);
    r.root.remove();
    r.wall.remove();
    if (main.scrollTop !== r.scroll) main.scrollTo({ top: r.scroll, behavior: 'instant' });
    removeEventListener('keydown', onKey, true);
    removeEventListener('resize', onResize);
  }

  // main.js calls this on every click after the first
  window.breakdown = start;
  start();
})();
