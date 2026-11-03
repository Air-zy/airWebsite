// the breakdown. click the 🤓 by the name and the whole site falls apart. a crack runs out of it along the wall, and when
// it snaps, more cracks run down the whole page and everything breaks as the shock gets to it. words and letters go
// crooked, hang off one corner, get misspelled or fall right off the bottom of the screen, the ones on a crack rip in
// half, pictures and emojis tear in two, links and buttons come loose and the plant tips over and drops. then a glitchy
// mechanical spider made of lines and ascii climbs over the page and fixes all of it with its legs, a word at a time. it
// taps each word, selects it and puts it right, reels the fallen ones back up on a thread, knits torn pictures and the
// plant shut with its two front legs and closes the cracks it walks over, typing out what it's doing on its back.
//
// the page still scrolls the whole time. the spider goes for what's broken on screen first, jumps over on a thread when
// that's far from it, and when you stop scrolling for a bit the page follows it around. clicks don't go through while
// it's broken, so nothing opens and moves things around mid fix. the skip button or esc puts it all back. main.js only
// loads this on that click. reduced motion gets a still version, things go crooked and come back group by group, with
// no cracks, shaking, falling or spider.
//
// nothing is a picture of the page. a word that breaks is wrapped in a span and hidden, and a copy with the same font
// and colour stands in for it, in a layer inside the page's scroller so it scrolls along, and every word moves on its
// own. links, buttons, notes and the plant are the real ones, moved where they are with transform. a picture or the 🤓
// can't be in two places, so it's hidden as well and two copies of it stand in, each cut off at the tear. once something's
// fixed the real one shows again, and at the end the spans come back out, so the page is left exactly how it was
(() => {
  // ---------- tuning
  const T_CRACK = 0.65;     // s, the first crack runs along the wall, then it snaps
  const WAVE = 1700;        // px/s, the snap spreads out from the 🤓 and breaks things as it gets to them
  const T_SPIDER = 1.4;     // s after the snap, the spider walks in
  const KICK = 18;          // px, the shake at the snap
  const GRAVITY = 2300;     // px/s²
  const MAX_WORDS = 420;    // the most words and letters that break, the ones near the 🤓 first
  const HEAL_R = 150;       // px, the cracks close up this near the spider
  const IDLE = 2.5;         // s without scrolling before the page follows the spider again
  const SEL = 0.14;         // s, a word's selection dragging across it, and letting go of it
  const BLINK = 0.04;       // s, how much of its flight a spark's streak shows
  const STITCH = 0.2;       // s, one stitch across a tear
  const PULL = 0.34;        // s, the thread pulling a tear shut along its length

  // the spider is drawn in 2.5d. the camera looks at the page a little from below, so something z px off the page
  // shows PY*z higher up the screen, and the light is up and to the left, so its shadow falls down and right of it
  const PY = 0.55, SHX = 0.42, SHY = 0.3;
  const LEN = [1.08, 1, 0.95, 1.04];   // leg length, front pair to back
  const WEIGHT = [1, 0.5, 0.25, 0.25]; // how much a foot lifting tips the body, front pair to back
  // a spark's colour as it cools: nearly white when it's thrown, pale yellow for most of its life, amber as it dies
  const COOLING = [[255, 253, 240], [255, 247, 196], [255, 230, 140], [250, 160, 70]];
  const HEAT = Array.from({ length: 33 }, (_, i) => {
    const at = (i / 32) * (COOLING.length - 1), n = Math.min(COOLING.length - 2, Math.floor(at)), p = at - n;
    return `rgb(${COOLING[n].map((c, j) => Math.round(c + (COOLING[n + 1][j] - c) * p))})`;
  });
  // eyes on the head: forward, out, up (of the head's radii), and size. each one twice, left and right
  const EYES = [[0.78, 0.3, 0.45, 2.3], [0.62, 0.6, 0.62, 1.4], [0.92, 0.12, 0.2, 1.3]];
  // the code on its back, what it starts with. what it does gets typed in below this and pushes it up
  const CODE = ['function mend(', '  page) {', '  for (const w', '    of page) {', '    fix(w);', '  }', '}', '', 'mend(site);'];
  const ROWS = CODE.length;

  const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
  const GLYPHS = '#%&@*+=-:./\\|<>[]{}01';
  const VOID_COL = '#09090c';
  const SKIP = 'script, style, textarea, dialog, #adapt';
  // these move as one piece. all other text breaks word by word, and big text letter by letter
  const RIGID = 'nav .nav-item, .menu-icon, .bubble, .flower canvas, main img, main svg, main button, main .sticky';
  // of those, these tear in two. so does a word with an emoji in it
  const TORN = '.bubble, main img, .flower canvas';
  const EMOJI = /\p{Emoji_Presentation}/u;
  const SCROLL_KEYS = [' ', 'ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End'];
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
    bg: cssVar('--bg-col'),
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

  // everything is placed on the page, not the screen: y counts from the top of the scroller's content, so it holds
  // still while the page scrolls. this takes a box measured on screen at the start onto the page
  const toPage = (r, b) => ({ left: b.left, right: b.right, width: b.width, height: b.height, top: b.top + r.dy, bottom: b.bottom + r.dy });

  let run = null, frame = 0;

  // ---------- the cracks

  // short ones off a long one, only drawn
  function branchesOf(points, n) {
    return Array.from({ length: n }, () => {
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
  }

  // a crack: its points, when each one shows, how wide its gap opens there, and when it closes again
  const crack = (points, dir, show, wide) => ({
    points, dir, show, wide, close: points.map(() => Infinity), branches: branchesOf(points, Math.max(3, Math.round(points.length / 7))),
  });

  // the first one: jagged, across the page through the 🤓, running out from it as it builds up. the left half heads for
  // the middle of the name, so it rips
  function crackAcross(r, aim) {
    const { origin: o, W } = r, left = [], right = [];
    for (const [dir, out] of [[-1, left], [1, right]]) {
      let x = o.x, y = o.y;
      const drift = rand(-0.25, 0.25);
      while (dir < 0 ? x > -40 : x < W + 40) {
        x += dir * rand(10, 22);
        y = clamp(y + rand(-8, 8) + drift * 10 + (dir < 0 ? (aim - y) * 0.14 : 0), o.y - 200, o.y + 200);
        out.push({ x, y });
      }
    }
    const points = [...left.reverse(), { ...o }, ...right], at = left.length, far = Math.max(at, points.length - at);
    // it runs out with the same ease out as the rest of it
    const show = points.map((p, i) => T_CRACK * (1 - Math.cbrt(1 - Math.abs(i - at) / far)));
    const c = crack(points, 'h', show, points.map((p, i) => 2 + 7 * Math.exp(-Math.abs(i - at) / 14)));
    c.origin = at;
    return c;
  }

  // the rest run from it down the whole page when it snaps, as fast as the shock spreads
  function crackDown(r, from) {
    const points = [{ ...from }];
    let { x, y } = from;
    const drift = rand(-0.3, 0.3);
    while (y < r.bottom + 30) {
      y += rand(14, 30);
      x = clamp(x + rand(-10, 10) + drift * 8, 6, r.W - 6);
      points.push({ x, y });
    }
    const show = points.map(p => r.at.snap + Math.hypot(p.x - r.origin.x, p.y - r.origin.y) / WAVE);
    return crack(points, 'v', show, points.map(() => rand(1.4, 3.2)));
  }

  // where a crack is: for one across, its height at v = x. for one running down, how far across it is at v = y
  function crackAt(c, v) {
    const p = c.points, [k, o] = c.dir === 'h' ? ['x', 'y'] : ['y', 'x'];
    for (let i = 1; i < p.length; i++) {
      if (p[i][k] >= v) return p[i - 1][o] + (p[i][o] - p[i - 1][o]) * ((v - p[i - 1][k]) / (p[i][k] - p[i - 1][k] || 1));
    }
    return p.at(-1)[o];
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

  // stand-ins where something is on the page, at box b. torn, it's two copies, each cut off at the tear, top and bottom
  // for one across, left and right for one running down. the box it falls and spins with is y0 to y1, for a word the part
  // with ink in it
  function standIns(r, b, tear, y0, y1, copy, o) {
    const W = b.width, H = b.height;
    const make = (clip, x0, x1, top, bottom) => {
      const node = copy();
      node.style.transformOrigin = `${(x0 + x1) / 2}px ${(top + bottom) / 2}px`;
      if (clip) node.style.clipPath = clip;
      r.layer.append(node);
      return actor(r, {
        node, ...o, w: Math.max(4, x1 - x0), h: Math.max(4, bottom - top), ox: (x0 + x1) / 2, oy: (top + bottom) / 2,
        hx: b.left + (x0 + x1) / 2, hy: b.top + (top + bottom) / 2,
      });
    };
    if (!tear) return [make(null, 0, W, y0, y1)];
    const T = tear.pts, pts = T.map(p => `${(p.x - b.left).toFixed(1)}px ${(p.y - b.top).toFixed(1)}px`);
    let one, two;
    if (!tear.v) {
      const ys = T.map(p => p.y - b.top);
      one = make(`polygon(-20px -20px,${W + 20}px -20px,${[...pts].reverse()})`, 0, W, y0, Math.max(...ys));
      two = make(`polygon(${pts},${W + 20}px ${H + 20}px,-20px ${H + 20}px)`, 0, W, Math.min(...ys), y1);
    } else {
      const xs = T.map(p => p.x - b.left), top = `${xs[0].toFixed(1)}px -20px`, bottom = `${xs.at(-1).toFixed(1)}px ${H + 20}px`;
      one = make(`polygon(-20px -20px,${top},${pts},${bottom},-20px ${H + 20}px)`, 0, Math.max(...xs), y0, y1);
      two = make(`polygon(${W + 20}px -20px,${top},${pts},${bottom},${W + 20}px ${H + 20}px)`, Math.min(...xs), W, y0, y1);
    }
    one.pair = two;
    two.pair = one;
    one.tear = T;
    one.v = tear.v;
    return [one, two];
  }

  // a word: a copy with the same font and colour
  function wordActors(r, k) {
    const b = toPage(r, k.span.getBoundingClientRect()), look = textLook(k.span), col = getComputedStyle(k.span).color;
    const copy = () => {
      const node = el('div', `position:absolute;left:0;top:0;margin:0;white-space:pre;height:${b.height}px;line-height:${b.height}px;${look}`);
      node.textContent = k.text;
      return node;
    };
    return standIns(r, b, k.tear, b.height * 0.12, b.height * 0.92, copy, { span: k.span, text: k.text, letter: k.letter, col, d: k.d });
  }

  // a picture or the 🤓, torn: the real one hidden, and two copies of it. the 🤓's copies keep its class for the tail,
  // that's a ::after, and everything else that came from where it sat goes on the copy
  function tornActors(r, e, b, d) {
    const cs = getComputedStyle(e), style0 = e.getAttribute('style');
    const copy = () => {
      const node = e.cloneNode(true);
      node.setAttribute('aria-hidden', 'true');
      node.tabIndex = -1;
      node.style.cssText = `position:absolute;left:0;top:0;margin:0;max-width:none;transition:none;width:${cs.width};height:${cs.height};object-fit:${cs.objectFit}`;
      // a canvas's copy comes out blank
      if (e.tagName === 'CANVAS') node.getContext('2d').drawImage(e, 0, 0);
      return node;
    };
    // the plant rips where the crack goes through it, or across its middle if the crack misses it. most of its box is
    // empty, so the knitting only goes over the part of the tear with plant on it
    let tear = e.tagName === 'CANVAS' && tearFor(r, b), ink = null;
    for (let tries = 0; e.tagName === 'CANVAS' && tries < 6; tries++) {
      tear ||= tearAcross(b);
      ink = inkOn(e, b, tear.pts);
      if (ink && ink[1] - ink[0] > 8) break;
      tear = null;
    }
    tear ||= tearAcross(b);
    const made = standIns(r, b, tear, 0, b.height, copy, { span: e, style0, col: cs.color, d });
    e.style.visibility = 'hidden';
    // all but the 🤓 get knitted shut
    if (e !== bubble) {
      for (const A of made) A.knit = true;
      Object.assign(made[0], { box: b, copy, ink });
    }
    return made;
  }

  // the first and last points of a tear with anything drawn near them
  function inkOn(e, b, T) {
    const d = e.getContext('2d').getImageData(0, 0, e.width, e.height).data, sx = e.width / b.width, sy = e.height / b.height;
    const on = T.map(p => {
      const x = Math.round((p.x - b.left) * sx), y = Math.round((p.y - b.top) * sy);
      for (let o = -4; o <= 4; o += 2) {
        for (const [i, j] of [[x, y + o], [x + o, y]]) {
          if (i >= 0 && j >= 0 && i < e.width && j < e.height && d[(j * e.width + i) * 4 + 3] > 20) return true;
        }
      }
      return false;
    });
    return on.includes(true) ? [on.indexOf(true), on.lastIndexOf(true)] : null;
  }

  // one half stays up crooked or hanging, the other mostly drops
  function ripFates([one, two]) {
    const x = Math.random();
    one.fate = x < 0.4 ? 'crook' : x < 0.75 ? 'hang' : 'fall';
    two.fate = Math.random() < 0.7 ? 'fall' : 'crook';
  }

  // a whole element, moved in place. its own size, and its transform-origin, so turning it can be made about its middle
  function elementActor(r, e, b, d) {
    const cs = getComputedStyle(e);
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

  // a crack running through a word rips it. the tear is jagged down to the pixel
  function tearFor(r, b) {
    for (const c of r.cracks) {
      const pts = [];
      if (c.dir === 'h') {
        const ys = [b.left, (b.left + b.right) / 2, b.right].map(x => crackAt(c, x));
        if (!ys.some(y => y > b.top + b.height * 0.2 && y < b.bottom - b.height * 0.15)) continue;
        for (let x = b.left - 2; x < b.right + 3; x += 3) pts.push({ x, y: crackAt(c, x) + rand(-1.3, 1.3) });
      } else {
        const x = crackAt(c, (b.top + b.bottom) / 2);
        if (b.top < c.points[0].y || x < b.left + b.width * 0.22 || x > b.right - b.width * 0.22) continue;
        for (let y = b.top - 2; y < b.bottom + 3; y += 3) pts.push({ x: crackAt(c, y) + rand(-1.3, 1.3), y });
      }
      return { pts, v: c.dir === 'v' };
    }
    return null;
  }

  // a picture or an emoji doesn't need a crack through it: a jagged line across its middle, on a slant, the short way
  // so the spider doesn't have far to knit
  function tearAcross(b) {
    const v = Math.abs(b.width - b.height) < 12 ? Math.random() < 0.5 : b.height < b.width;
    const len = v ? b.height : b.width, n = Math.max(4, Math.round(len / 6)), jag = clamp(len * 0.03, 1, 3.5);
    const start = v ? b.top : b.left, [lo, size] = v ? [b.left, b.width] : [b.top, b.height];
    const a = lo + size * rand(0.35, 0.65), z = lo + size * rand(0.35, 0.65), pts = [];
    for (let i = 0; i <= n; i++) {
      const along = start - 2 + ((len + 4) * i) / n, off = a + ((z - a) * i) / n + rand(-jag, jag);
      pts.push(v ? { x: off, y: along } : { x: along, y: off });
    }
    return { pts, v };
  }

  function collect(r) {
    const { W, origin } = r;
    const real = b => b.width > 1 && b.height > 1;
    // actually showing. what's in a closed details still has a box to measure, so the box alone doesn't say
    const shown = e => (e.checkVisibility ? e.checkVisibility({ visibilityProperty: true }) : !e.closest('details:not([open]) > :not(summary)'));
    const dist = b => Math.hypot(b.left + b.width / 2 - origin.x, b.top + b.height / 2 - origin.y);
    // near the 🤓 things break harder
    const near = d => clamp(1.15 - d / 1600, 0.35, 1);
    const hitAt = d => r.at.snap + d / WAVE + rand(0, 0.05);

    for (const e of document.querySelectorAll(RIGID)) {
      if (e.parentElement.closest(RIGID)) continue;
      const cb = e.getBoundingClientRect(), inNav = nav.contains(e);
      if (!real(cb) || cb.width > W * 0.8 || !shown(e)) continue;
      const b = toPage(r, cb), d = dist(b), q = near(d), x = Math.random(), at = e === bubble ? r.at.snap : hitAt(d);
      if (!r.calm && e.matches(TORN)) {
        const made = tornActors(r, e, b, d);
        ripFates(made);
        for (const A of made) { A.q = q; A.hit = at; }
        // both halves of the 🤓 pop off, away from each other
        if (e === bubble) made.forEach((A, i) => { A.fate = 'launch'; A.kick = i ? 1 : -1; });
        // the top of the plant tips over, the stump stays standing
        if (e.tagName === 'CANVAS') {
          made[0].fate = 'topple';
          Object.assign(made[1], { fate: 'crook', stump: true });
        }
        continue;
      }
      const A = elementActor(r, e, b, d);
      A.q = q;
      A.nav = inNav;
      A.hit = at;
      // the nav stays on screen while the page scrolls under it, so nothing in it falls, it only hangs or goes crooked
      A.fate = e === bubble ? 'launch' : e.matches('.flower canvas') ? 'topple'
        : !inNav && x < 0.32 * q ? 'fall' : x < 0.68 * q ? 'hang' : 'crook';
    }

    // the words on the whole page, measured where they are before anything changes. about half of them near the 🤓
    // break, a third of them far from it
    const words = [];
    for (const scope of [nav, main]) {
      const walk = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
      for (let n; (n = walk.nextNode());) {
        const parent = n.parentElement;
        if (!/\S/.test(n.data) || parent.closest(SKIP) || parent.closest(RIGID) || !shown(parent)) continue;
        const cs = getComputedStyle(parent);
        const letter = parseFloat(cs.fontSize) >= 21;
        for (const m of n.data.matchAll(letter ? /\S/gu : /\S+/g)) {
          const range = document.createRange();
          range.setStart(n, m.index);
          range.setEnd(n, m.index + m[0].length);
          const rects = range.getClientRects();
          if (rects.length !== 1 || !real(rects[0])) continue;
          const b = toPage(r, rects[0]), d = dist(b), emoji = EMOJI.test(m[0]);
          if (!emoji && Math.random() > 0.2 + 0.4 * near(d)) continue;
          words.push({ n, start: m.index, end: m.index + m[0].length, text: m[0], letter, emoji, b, d, score: d * rand(0.7, 1.3) });
        }
      }
    }
    const chosen = words.sort((a, b) => a.score - b.score).slice(0, MAX_WORDS);
    if (!r.calm) for (const k of chosen) k.tear = tearFor(r, k.b) || (k.emoji ? tearAcross(k.b) : null);

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
        // the one across rips as it snaps, the ones down the page as the shock gets there
        ripFates(made);
        const at = k.tear.v ? hitAt(k.d) : r.at.snap + rand(0, 0.04);
        for (const A of made) { A.q = q; A.hit = at; }
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

  // what broke, in the order you'd read it. the spider does one thing at a time, the halves of something torn counting as
  // one. reduced motion has no spider, things come back a group at a time, close ones together, more on a longer page
  function group(r) {
    const list = r.actors.filter(A => A.fate).sort((a, b) => Math.round(a.hy / 30) - Math.round(b.hy / 30) || a.hx - b.hx);
    const most = r.calm ? Math.round(clamp(r.bottom / 200, 14, 36)) : Infinity;
    let R = r.calm ? 80 : 0, out;
    do {
      out = [];
      const left = new Set(list);
      for (const A of list) {
        if (!left.has(A)) continue;
        const c = { members: [], x: 0, y: 0, taken: false, nav: A.nav };
        for (const B of left) {
          if (B.nav !== A.nav || Math.hypot(B.hx - A.hx, B.hy - A.hy) > R) continue;
          // the halves of a ripped word always go together
          for (const X of B.pair ? [B, B.pair] : [B]) {
            if (left.delete(X)) c.members.push(X);
          }
        }
        c.x = c.members.reduce((s, B) => s + B.hx, 0) / c.members.length;
        c.y = c.members.reduce((s, B) => s + B.hy, 0) / c.members.length;
        c.text = c.members.every(B => B.text);
        c.knit = c.members.some(B => B.knit);
        out.push(c);
      }
      R *= 1.25;
    } while (out.length > most);
    r.clusters = out;
  }

  // ---------- physics

  // where it is. a copy's box is placed directly. the real element is moved by a transform about its own
  // transform-origin, so the shift makes up the difference to turning it about its middle. nothing's written when
  // nothing moved
  function pose(A, jx = 0, jy = 0) {
    const c = Math.cos(A.a), s = Math.sin(A.a);
    let tf;
    if (A.own) {
      const px = A.w / 2 - A.ox, py = A.h / 2 - A.oy;
      let tx = A.cx - A.hx + jx + px - (c * px - s * py), ty = A.cy - A.hy + jy + py - (s * px + c * py);
      if (A.tilt) [tx, ty] = [Math.cos(A.tilt) * tx + Math.sin(A.tilt) * ty, -Math.sin(A.tilt) * tx + Math.cos(A.tilt) * ty];
      tf = `translate(${tx.toFixed(2)}px,${ty.toFixed(2)}px) rotate(${A.a.toFixed(4)}rad)`;
    } else {
      tf = `translate(${(A.cx - A.ox + jx).toFixed(2)}px,${(A.cy - A.oy + jy).toFixed(2)}px) rotate(${A.a.toFixed(4)}rad)`;
    }
    if (tf !== A.tf) A.node.style.transform = A.tf = tf;
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


  // hanging off a pin. gravity turns it about the pin
  function swing(A, dt) {
    const { x, y, rx, ry } = A.pin, k2 = (A.w * A.w + A.h * A.h) / 12 + rx * rx + ry * ry;
    const at = a => [x + Math.cos(a) * rx - Math.sin(a) * ry, y + Math.sin(a) * rx + Math.cos(a) * ry];
    A.va += ((at(A.a)[0] - x) * GRAVITY / k2) * dt;
    A.va *= Math.exp(-dt * (A.mode === 'topple' ? 0.4 : 1.1));
    A.a += A.va * dt;
    [A.cx, A.cy] = at(A.a);
  }

  // falling free. there's no ground, it keeps going, tumbling, until it's off the screen
  function fall(A, dt) {
    A.vy += GRAVITY * dt;
    A.cx += A.vx * dt;
    A.cy += A.vy * dt;
    A.a += A.va * dt;
  }

  // off the bottom of the screen or out the side, it's gone. it's put back where it was, hidden, until the spider reels
  // it in, so nothing lying far below the page makes it longer to scroll
  function lose(A) {
    A.mode = 'lost';
    A.node.style.visibility = 'hidden';
    A.cx = A.hx;
    A.cy = A.hy;
    A.a = A.vx = A.vy = A.va = 0;
    pose(A);
  }

  // the shock gets to it
  function hit(r, A) {
    const dx = A.hx - r.origin.x, dy = A.hy - r.origin.y, d = Math.hypot(dx, dy) || 1;
    const nx = dx / d, ny = dy / d, q = A.q, size = Math.sqrt(A.w * A.h);
    A.mode = A.fate === 'launch' ? 'fall' : A.fate;
    if (A.fate === 'typo') A.node.textContent = A.wrong;
    if (A.fate === 'launch') {
      // the 🤓 itself pops off
      A.vx = A.kick * rand(60, 220);
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
      if (!A.nav && Math.random() < 0.3) A.snapAt = r.t + rand(0.8, 2.4);
    } else if (A.fate === 'topple') {
      // the plant tips over away from the 🤓, about its base
      A.pin = { x: A.hx, y: A.hy + A.h / 2, rx: 0, ry: -A.h / 2 };
      A.va = (A.hx < r.origin.x ? -1 : 1) * rand(0.5, 0.9);
    } else {
      // knocked crooked, it wobbles into a new pose and stays there
      const soft = A.fate === 'typo' ? 0.4 : A.stump ? 0.06 : 1;
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
    chips(r, A.cx, A.cy, A.text ? (A.letter ? 4 : 2) : 6, 200 * q, A.col);
  }

  // jabbed by the spider: it springs home. a word's home is measured again first, in case something above it changed size
  // since. what fell off the screen comes back up from below it, and what ended up far away gets a thread. a word is only
  // tapped and gets selected, the sparks and the thud are for pictures and things that hit harder
  function fix(r, c, L) {
    if (!c.text) {
      r.thud = Math.max(r.thud, 2.4);
      sparks(r, c.x, c.y, 16);
      glyphs(r, c.x, c.y, 7, 150);
    }
    for (const A of c.members) {
      if (A.mode === 'home' || A.mode === 'done') continue;
      if (A.mode === 'lost') {
        A.cx = clamp(A.hx + rand(-120, 120), 0, r.W);
        A.cy = r.view.bottom + Math.hypot(A.w, A.h) / 2 + 30;
        A.a = rand(-2, 2);
        A.node.style.visibility = '';
      }
      if (!A.own) {
        const b = A.span.getBoundingClientRect();
        A.hx = b.left - r.sh.x + A.ox;
        A.hy = b.top - r.sh.y - r.mainTop + main.scrollTop + A.oy;
      }
      A.reel = Math.hypot(A.cx - A.hx, A.cy - A.hy) > 70;
      if (A.reel && L) r.threads.push({ A, L });
      A.mode = 'fix';
      A.a = wrapAngle(A.a);
      if (A.text) A.sel = A.off = 0;
      else A.glow = 1;
      if (A.fate === 'typo') A.decode = r.t;
    }
    if (L) {
      const A = c.members[0];
      say(r.spider, A.fate === 'typo' ? `typo('${A.wrong.slice(0, 7)}');` : c.text ? `fix('${A.text.slice(0, 7)}');` : c.knit ? 'reel(img);' : 'reel(el);');
    }
    if (c.knit && L) startKnit(r, r.spider, c);
  }

  // text gets selected while it's put right, in the site's own ::selection colours, the way you'd drag across a word to
  // fix it. it doesn't start until the word's nearly back, it's held until it's home, then let go the same way
  function select(A, dt) {
    if (A.mode === 'fix' && Math.hypot(A.cx - A.hx, A.cy - A.hy) > 30) return;
    A.sel += dt;
    if (A.mode === 'home' && A.sel > SEL * 2) A.off += dt;
    const from = Math.round(ease(A.off / SEL) * 100), to = Math.round(ease(A.sel / SEL) * 100), now = from * 1000 + to;
    if (now === A.painted) return;
    A.painted = now;
    const s = A.node.style;
    s.webkitTextFillColor = 'transparent';
    s.backgroundImage = `linear-gradient(90deg,${A.col} ${from}%,${C.bg} ${from}%,${C.bg} ${to}%,${A.col} ${to}%),`
      + `linear-gradient(90deg,transparent ${from}%,${C.text} ${from}%,${C.text} ${to}%,transparent ${to}%)`;
    s.webkitBackgroundClip = 'text,border-box';
  }

  function update(r, A, t, dt) {
    if (A.mode === 'done' || A.mode === 'held' || A.mode === 'lost') return;
    if (A.mode === 'still') {
      if (t >= A.hit) hit(r, A);
      else if (t < r.at.snap) {
        // the crack's coming, things near it shiver. the 🤓 most
        const p = t / T_CRACK, j = (A.fate === 'launch' ? 3 : 1.4) * p * A.q;
        // two halves are still one piece, so they shake as one
        if (A.d < p * 900) {
          if (!A.pair || A.tear) { A.jx = rand(-j, j); A.jy = rand(-j, j); }
          const o = A.pair && !A.tear ? A.pair : A;
          pose(A, o.jx, o.jy);
        }
        return;
      }
      // waiting for the shock, put back straight once after shivering
      if (!A.still) { A.still = true; pose(A); }
      return;
    }
    if (A.mode === 'crook' || A.mode === 'typo') {
      // once it's stopped wobbling it's left alone, unless it's glitching
      if (!A.flick && Math.abs(A.vx) + Math.abs(A.vy) < 0.4 && Math.abs(A.va) < 0.004 && Math.abs(A.cx - A.hx - A.dx) + Math.abs(A.cy - A.hy - A.dy) < 0.3) {
        if (!A.settled) pose(A);
        A.settled = true;
        return;
      }
      A.settled = false;
      spring(A, A.hx + A.dx, A.hy + A.dy, A.ta, 220, 0.3, dt);
    }
    else if (A.mode === 'hang' || A.mode === 'topple') {
      swing(A, dt);
      // a hanging one sometimes gives way, and the plant drops once it's tipped too far to stand. either carries on the
      // way it was swinging
      if ((A.snapAt && t > A.snapAt) || (A.mode === 'topple' && Math.abs(A.a) > 1.1)) {
        A.mode = 'fall';
        A.vx = -A.va * (A.cy - A.pin.y);
        A.vy = A.va * (A.cx - A.pin.x);
        A.va *= 1.5;
        chips(r, A.pin.x, A.pin.y, 3, 120, A.col);
      }
    } else if (A.mode === 'fall') {
      fall(A, dt);
      const reach = Math.hypot(A.w, A.h) / 2;
      if (A.cy - reach > r.view.bottom || A.cx + reach < -20 || A.cx - reach > r.W + 20) return lose(A);
    } else if (A.mode === 'fix') {
      // something being knitted goes to where the opening has it, not home
      const to = A.to || { x: A.hx, y: A.hy, a: 0 };
      spring(A, to.x, to.y, to.a, A.snap ? 700 : A.reel ? 120 : 260, A.snap ? 0.55 : A.reel ? 0.7 : A.to ? 0.8 : 0.42, dt);
      if (A.decode != null) {
        // the letters scramble and settle on the right ones, left to right
        const p = (t - A.decode) / 0.45, ch = [...A.text];
        A.node.textContent = p >= 1 ? A.text : ch.map((c, i) => (i < p * ch.length ? c : pick(GLYPHS))).join('');
        if (p >= 1) A.decode = null;
      }
      if (!A.to && Math.hypot(A.cx - A.hx, A.cy - A.hy) < 0.35 && Math.hypot(A.vx, A.vy) < 6 && Math.abs(A.a) < 0.003
        && Math.abs(A.va) < 0.05 && A.decode == null) {
        A.cx = A.hx;
        A.cy = A.hy;
        A.a = 0;
        A.mode = 'home';
      }
    }
    if (A.glow > 0) {
      // fixed, it flashes white hot like a weld and cools back down
      A.glow = Math.max(0, A.glow - dt * 2.2);
      A.node.style.filter = A.glow ? `brightness(${(1 + 1.6 * A.glow * A.glow).toFixed(2)})` : '';
    }
    if (A.sel != null) select(A, dt);
    if (A.mode === 'home') {
      // back where it belongs. a ripped one waits for its other half, then they're welded. text waits to be let go of first
      if ((A.pair && A.pair.mode !== 'home') || (A.sel != null && A.off < SEL)) return pose(A);
      if (A.pair && !A.knit) {
        const one = A.tear ? A : A.pair;
        r.welds.push({ pts: one.tear, t });
        for (let i = 0; i < one.tear.length; i += 4) sparks(r, one.tear[i].x, one.tear[i].y, 1);
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
      A.whole?.remove();
      restoreStyle(A.span, A.style0);
    }
  }


  // broken things on screen glitch now and then, a colour split and a jump to the side. a typo flickers to garbage
  function flicker(r, t) {
    for (const A of r.actors) {
      if (A.flick && --A.flick === 0 && A.mode !== 'done') {
        if (!A.glow) A.node.style.filter = '';
        if (A.mode === 'typo') A.node.textContent = A.wrong;
      }
    }
    if (Math.random() > 0.5) return;
    for (let tries = 0; tries < 6; tries++) {
      const A = pick(r.actors);
      if (!A || A.flick || A.cy < r.view.top - r.mainTop || A.cy > r.view.bottom) continue;
      const live = t < r.at.snap ? A.d < (t / T_CRACK) * 900 && A.mode === 'still' : BROKEN.has(A.mode);
      if (!live) continue;
      A.flick = 2 + Math.floor(Math.random() * 4);
      A.node.style.filter = 'drop-shadow(2px 0 rgba(255,40,90,.7)) drop-shadow(-2px 0 rgba(40,240,255,.7))';
      if (A.mode === 'typo') A.node.textContent = glitched(A.wrong);
      return;
    }
  }

  // ---------- particles

  // bits off broken things, they drop away
  function chips(r, x, y, n, power, col) {
    for (let i = 0; i < n; i++) {
      r.parts.push({ x, y, vx: rand(-1, 1) * power, vy: rand(-1.4, 0.3) * power, s: rand(1.4, 3.4), col, life: rand(1, 2.2) });
    }
  }
  // characters kicked out where a foot comes down
  function glyphs(r, x, y, n, power) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2), v = rand(0.4, 1) * power;
      r.glyphs.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, ch: pick('*+x#%/\\'), t: r.t, life: rand(0.3, 0.55), col: Math.random() < 0.25 ? C.accent : C.tech });
    }
  }
  // off a jab, they fly up off the page and fall back. most are slow, a few shoot off fast, and some burst on the way
  function sparks(r, x, y, n) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2), v = rand(60, 260) * (Math.random() < 0.2 ? 3 : 1), life = rand(0.3, 0.7);
      r.parts.push({
        x, y, z: 2, vx: Math.cos(a) * v, vy: Math.sin(a) * v, vz: rand(120, 420), spark: true, life, max: life,
        fork: Math.random() < 0.3 ? life * rand(0.4, 0.7) : 0,
      });
    }
  }

  // ---------- the spider

  // its size goes with the screen
  function dims(W, H) {
    const k = clamp(Math.min(W, H * 1.4) / 900, 0.6, 1), deg = Math.PI / 180;
    return {
      k, thigh: 88 * k, shin: 116 * k, z: 46 * k, lag: 48 * k, lift: 30 * k, speed: 420 * Math.max(k, 0.85), reach: 190 * k, stepTime: 0.13,
      // hips on the body, ahead and out to the side. feet at rest, at an angle from straight ahead and a distance
      hips: [[17, 11], [9, 15], [0, 15], [-9, 12]].map(([u, v]) => [u * k, v * k]),
      rests: [[40, 152], [80, 140], [113, 136], [146, 150]].map(([a, d]) => [Math.cos(a * deg) * d * k, Math.sin(a * deg) * d * k]),
    };
  }


  // a line of the code on its back, coloured: keywords gold, strings cream, the rest teal
  function codeLine(text) {
    const cols = Array(text.length).fill(C.tech);
    for (const m of text.matchAll(/\b(function|const|for|of)\b/g)) cols.fill(C.accent, m.index, m.index + m[0].length);
    for (const m of text.matchAll(/'[^']*'?/g)) cols.fill(C.text, m.index, m.index + m[0].length);
    return { text, cols };
  }
  // something for it to type. it can't keep up with every word, so it only ever has the last few to get through
  function say(s, text) {
    s.next.push(text.replace(/[^ -~]/g, ''));
    if (s.next.length > 3) s.next.shift();
  }

  // it comes in from just above the screen
  function makeSpider(r) {
    const D = dims(r.W, r.H);
    const s = {
      D, x: r.W / 2 + rand(-80, 80), y: r.view.top - r.mainTop - 230 * D.k, z: D.z, h: Math.PI / 2,
      vx: 0, vy: 0, t: 0, glitch: 0.4, legs: [],
      // how the body rides on its legs: tipped nose up, tipped right side up, sunk in, the abdomen trailing to the side and
      // dropping behind, and the head turned and nodded. each has its speed beside it, for its spring
      pitch: 0, pitchV: 0, roll: 0, rollV: 0, sag: 0, sagV: 0, tail: 0, tailV: 0, belly: 0, bellyV: 0, look: 0, lookV: 0, nod: 0, nodV: 0,
      was: Math.PI / 2, eyeAt: 0, hop: 0, dx: 0, dy: 1, code: CODE.map(codeLine), next: [], typed: 99,
    };
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
  // how far up the tilt of the body takes a point on it
  const tiltZ = (s, u, v) => u * Math.sin(s.pitch) + v * Math.sin(s.roll);
  const hipOf = (s, L) => {
    const u = s.D.hips[L.i][0], v = s.D.hips[L.i][1] * L.side;
    return local(s, u, v, s.z + tiltZ(s, u, v));
  };
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


  // a damped spring on one of the numbers in makeSpider
  function sway(s, key, to, k, z, dt) {
    const v = key + 'V';
    s[v] += (k * (to - s[key]) - 2 * Math.sqrt(k) * z * s[v]) * dt;
    s[key] += s[v] * dt;
  }

  // the body rides on its legs. a foot off the page takes weight off, so the body sinks a little and tips away from it onto
  // the feet still down, the front legs counting most because they lift highest. that's its bob, it comes from the steps.
  // the abdomen trails the thorax on its joint, and the head turns to what a leg's on and stays on it for a moment
  function ride(s, dt) {
    const D = s.D, k = D.k;
    // the code on its back types on
    s.typed += dt * 34;
    if (s.next.length && s.typed >= s.code.at(-1).text.length + 3) {
      s.code.push(codeLine(s.next.shift()));
      s.code = s.code.slice(-ROWS);
      s.typed = 0;
    }
    let sink = 0, nose = 0, side = 0;
    if (!s.leap) {
      for (const L of s.legs) {
        const off = clamp(L.f.z / D.lift, 0, 1);
        sink += off;
        nose += off * (L.i < 2 ? 1 : -0.5);
        side += off * L.side * WEIGHT[L.i];
      }
    }
    sway(s, 'sag', -sink * 1.1 * k, 110, 0.5, dt);
    sway(s, 'pitch', nose * 0.05, 90, 0.5, dt);
    sway(s, 'roll', side * 0.16, 90, 0.5, dt);
    s.z = D.z + s.sag + s.hop;

    s.tail = clamp(s.tail - wrapAngle(s.h - s.was), -0.45, 0.45);
    s.was = s.h;
    sway(s, 'tail', -s.roll * 1.2, 60, 0.6, dt);
    sway(s, 'belly', s.sag, 70, 0.45, dt);

    if (s.knit) s.eye = s.knit.at;
    else if (s.t > s.eyeAt) {
      s.eye = s.legs.find(L => L.task?.phase < 2)?.task.c || s.focus;
      s.eyeAt = s.t + 0.35;
    }
    const head = local(s, 40 * k, 0, 0), a = s.eye && !s.leap ? wrapAngle(Math.atan2(s.eye.y - head.y, s.eye.x - head.x) - s.h) : 0;
    sway(s, 'look', Math.abs(a) < 1.7 ? clamp(a, -0.9, 0.9) : 0, 120, 0.8, dt);
    sway(s, 'nod', a ? -0.18 : 0, 120, 0.8, dt);
  }

  // the body goes with a jab, down into it and over to that leg's side
  function lean(s, L, f) {
    s.pitchV -= 1.6 * f;
    s.rollV -= 1.2 * L.side * f;
    s.sagV -= 30 * s.D.k * f;
  }

  function updateSpider(r, dt) {
    const s = r.spider, D = s.D;
    s.t += dt;
    // now and then it glitches for a moment
    s.glitch -= dt;
    if (s.glitch <= 0 && Math.random() < dt * 0.9) {
      s.glitch = rand(0.06, 0.22);
      s.asciiLegs = Math.random() < 0.5;
    }
    ride(s, dt);
    if (s.leap) return fly(r, s, dt);
    if (s.knit) knit(r, s, dt);
    const todo = r.clusters.filter(c => !c.taken);
    let busy = s.legs.filter(L => L.task).length;

    // where to: what's broken on screen first, otherwise the top of what's left. the nearest one there, standing off
    // it by half a leg, or under it for the nav, which stays at the top of the screen
    let goal = { x: s.x, y: s.y };
    if (s.knit) {
      // it stands back from the tear, facing it, and follows the stitches along
      const K = s.knit;
      goal = { x: K.at.x + K.nx * K.side * D.reach * 0.6, y: K.at.y + K.ny * K.side * D.reach * 0.6 };
      s.dx = K.at.x - s.x;
      s.dy = K.at.y - s.y;
    } else if (todo.length) {
      if (!s.focus || s.focus.taken || s.t > s.repick) {
        const seen = todo.filter(c => c.y > r.view.top - r.mainTop - 20 && c.y < r.view.bottom + 20);
        const pool = seen.length ? seen : todo, d = c => Math.hypot(c.x - s.x, c.y - s.y);
        const top = Math.min(...pool.map(c => c.y));
        s.focus = pool.filter(c => c.y < top + 180).reduce((a, c) => (d(c) < d(a) ? c : a));
        s.repick = s.t + 0.5;
      }
      const c = s.focus, dx = c.x - s.x, dy = c.y - s.y, d = Math.hypot(dx, dy) || 1;
      goal = c.nav ? { x: c.x, y: c.y + 100 * D.k } : { x: c.x - (dx / d) * D.reach * 0.5, y: c.y - (dy / d) * D.reach * 0.5 };
      // too far to walk, it jumps there on a thread
      if (!busy && Math.hypot(goal.x - s.x, goal.y - s.y) > (r.H - r.mainTop) * 0.7) return leap(r, s, goal);
    } else if (!busy) {
      // all fixed, it's pulled back up off the top of the screen on its thread
      return leap(r, s, { x: s.x, y: r.view.top - r.mainTop - 420 * D.k }, true);
    }

    // walk there, slowly while a leg is busy, turning to face the way it goes
    const gx = goal.x - s.x, gy = goal.y - s.y, gd = Math.hypot(gx, gy);
    const sp = Math.min(D.speed * (busy ? 0.6 : 1), gd * 2.4);
    s.vx += ((gd > 0.5 ? (gx / gd) * sp : 0) - s.vx) * Math.min(1, dt * 3);
    s.vy += ((gd > 0.5 ? (gy / gd) * sp : 0) - s.vy) * Math.min(1, dt * 3);
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    const v = Math.hypot(s.vx, s.vy);
    // it faces the way it's going overall, not each little move, so working back and forth along a line doesn't swing it
    // about. it turns at its own pace too, slower while a leg's busy, and walks sideways for a moment instead of spinning
    s.dx += (s.vx - s.dx) * Math.min(1, dt * 1.2);
    s.dy += (s.vy - s.dy) * Math.min(1, dt * 1.2);
    const most = (busy ? 0.9 : 1.7) * dt;
    if (v > 35 || s.knit) s.h += clamp(wrapAngle(Math.atan2(s.dy, s.dx) - s.h) * Math.min(1, dt * 2.6), -most, most);
    // a step takes as long as the body takes to pass over it, so it isn't scurrying when it's only crawling
    const stepTime = clamp((D.stepTime * D.speed) / Math.max(v, 1), D.stepTime, 0.3);

    // anything a free front leg can reach gets jabbed, four at a time. nothing new while it's knitting, and one tear at a time
    for (const c of s.knit ? [] : todo) {
      if (busy >= 4) break;
      if (c.knit && s.legs.some(L => L.task?.c?.knit)) continue;
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
      L.step.t = Math.min(1, L.step.t + dt / stepTime);
      const e = ease(L.step.t), { from, to } = L.step;
      L.f = { x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e, z: Math.sin(Math.PI * L.step.t) * D.lift };
      if (L.step.t < 1) { stepping[L.group]++; continue; }
      L.step = null;
      r.thud = Math.max(r.thud, 0.7);
    }
    for (const L of s.legs) {
      if (L.step || L.task) continue;
      const to = restOf(s, L), dx = to.x - L.f.x, dy = to.y - L.f.y, far = Math.hypot(dx, dy);
      if (far < D.lag || (stepping[1 - L.group] && far < D.lag * 2.2)) continue;
      const k = (0.65 * D.lag) / far;
      L.step = { t: 0, from: { ...L.f }, to: { x: to.x + dx * k, y: to.y + dy * k, z: 0 } };
      stepping[L.group]++;
    }

    // the cracks close up around it as it goes, out from under it
    for (const c of r.cracks) {
      c.points.forEach((p, i) => {
        if (c.close[i] !== Infinity || r.t < c.show[i]) return;
        const d = Math.hypot(p.x - s.x, p.y - s.y);
        if (d < HEAL_R * D.k) c.close[i] = r.t + d / 1500;
      });
    }
  }

  // a jump on a thread, or leaving for good up off the screen
  function leap(r, s, to, exit) {
    const d = Math.hypot(to.x - s.x, to.y - s.y);
    say(s, exit ? 'exit();' : 'jump();');
    s.leap = { from: { x: s.x, y: s.y }, to, t: 0, exit, dur: exit ? 0.9 : clamp(d / 1800, 0.55, 1.2), hop: (exit ? 50 : Math.min(240, d * 0.18)) * s.D.k };
    // the thread runs from where it took off, or for leaving, from far up off the screen
    r.silk = { x: s.x, y: exit ? s.y - 4000 : s.y, until: Infinity };
    for (const L of s.legs) L.step = null;
    s.glitch = Math.max(s.glitch, 0.12);
  }
  function fly(r, s, dt) {
    const J = s.leap, D = s.D;
    J.t += dt;
    const p = clamp(J.t / J.dur, 0, 1), e = p < 0.5 ? 2 * p * p : 1 - (2 - 2 * p) ** 2 / 2;
    const x = J.from.x + (J.to.x - J.from.x) * e, y = J.from.y + (J.to.y - J.from.y) * e;
    if (!J.exit && Math.hypot(x - s.x, y - s.y) > 0.5) s.h += wrapAngle(Math.atan2(y - s.y, x - s.x) - s.h) * Math.min(1, dt * 6);
    s.x = x;
    s.y = y;
    s.hop = Math.sin(Math.PI * p) * J.hop;
    s.z = D.z + s.sag + s.hop;
    // legs pulled in under it
    for (const L of s.legs) L.f = local(s, D.rests[L.i][0] * 0.45, D.rests[L.i][1] * 0.45 * L.side, Math.max(0, s.z - 36 * D.k));
    if (p < 1) return;
    s.leap = null;
    if (J.exit) { s.gone = true; return; }
    // lands with a thud, feet down where they'd stand
    for (const L of s.legs) L.f = restOf(s, L);
    s.hop = 0;
    s.sagV -= 190 * D.k;
    s.pitchV -= 1.2;
    r.thud = Math.max(r.thud, 3);
    glyphs(r, s.x, s.y, 12, 260);
    chips(r, s.x, s.y, 10, 160, C.grey);
    r.silk.until = r.t;
  }

  // a leg fixing something: up and over it, a jab, holding there while it comes back, then straight on to the next thing
  // it can reach, or back to walking
  function work(r, s, L, dt) {
    const T = L.task, c = T.c, k = s.D.k, hover = 64 * k;
    if (T.knit) return needle(s, L);
    const next = phase => { T.phase = phase; T.t = 0; T.from = { ...L.f }; };
    T.t += dt;
    if (T.phase === 0) {
      const p = ease(T.t / 0.24);
      L.f = {
        x: T.from.x + (c.x - T.from.x) * p, y: T.from.y + (c.y - T.from.y) * p,
        z: T.from.z + (hover - T.from.z) * p + Math.sin(Math.PI * p) * 24 * k,
      };
      if (T.t >= 0.24) next(1);
    } else if (T.phase === 1) {
      L.f = { x: c.x, y: c.y, z: hover * (1 - clamp(T.t / 0.06, 0, 1) ** 2) };
      if (T.t >= 0.06) { next(2); fix(r, c, L); lean(s, L, c.text ? 0.45 : 1); }
    } else if (T.phase === 2) {
      L.f = { x: c.x + rand(-0.8, 0.8), y: c.y + rand(-0.8, 0.8), z: 0 };
      if (!c.text && Math.random() < dt * 30) sparks(r, c.x, c.y, 1);
      // until it's nearly all back, it settles on its own after
      if ((T.t > 0.12 && c.members.every(A => A.mode !== 'fix' || Math.hypot(A.cx - A.hx, A.cy - A.hy) < 18)) || T.t > 0.6) {
        const h = hipOf(s, L), tearing = s.legs.some(O => O.task?.c?.knit);
        const more = !s.knit && r.clusters.find(o => !o.taken && !(o.knit && tearing) && Math.hypot(o.x - h.x, o.y - h.y) < s.D.reach * 0.92);
        if (!more) return next(3);
        more.taken = true;
        L.task = { c: more, phase: 0, t: 0, from: { ...L.f } };
      }
    } else {
      const to = restOf(s, L), p = ease(T.t / 0.18);
      L.f = { x: T.from.x + (to.x - T.from.x) * p, y: T.from.y + (to.y - T.from.y) * p, z: Math.sin(Math.PI * p) * 34 * k };
      if (T.t >= 0.18) { L.task = null; L.f.z = 0; }
    }
  }
  // ---------- knitting a tear shut

  // a jab reels a torn picture back, but only as far as the tear held open in a v. the two front legs lace it, one stitch at
  // a time across the gap, swapping sides each time. the stitches hang loose. when they're all in, the legs haul back on the
  // thread and it pulls shut along its length like a drawstring. the part that's shut is a third copy, whole, and what's
  // still open is the two halves, cut back to where the pull has got to
  const seam = (K, p) => K.T[Math.round(K.a + Math.min(1, p) * (K.b - K.a))];
  const seamAt = (K, p) => {
    const q = seam(K, p);
    return { x: K.left + q.x, y: K.top + q.y };
  };
  // a point fixed to a piece, wherever that piece has got to
  const onPiece = (A, p) => {
    const c = Math.cos(A.a), n = Math.sin(A.a);
    return { x: A.cx + c * p.x - n * p.y, y: A.cy + n * p.x + c * p.y };
  };

  function startKnit(r, s, c) {
    const one = c.members.find(A => A.tear), two = one.pair, box = one.box, left = one.hx - one.ox, top = one.hy - one.oy;
    const T = one.tear.map(p => ({ x: p.x - box.left, y: p.y - box.top })), [a, b] = one.ink || [0, T.length - 1];
    const L = Math.hypot(T[b].x - T[a].x, T[b].y - T[a].y) || 1;
    const nx = one.v ? 1 : 0, ny = one.v ? 0 : 1, W = box.width, H = box.height, n = clamp(Math.round(L / 18), 5, 14);
    const K = { c, one, two, T, a, b, L, n, W, H, left, top, nx, ny, sx: ny, sy: nx, v: one.v, i: 0, p: 0, y: 0, on: false, open: clamp(L * 0.16, 10, 34), whole: one.copy() };
    K.side = Math.sign((s.x - left - W / 2) * nx + (s.y - top - H / 2) * ny) || 1;
    // a stitch goes through each half, a little off square to the tear like a hand would do it
    K.bars = Array.from({ length: n }, (_, i) => {
      const q = seamAt(K, (i + 0.5) / n), w = rand(8, 11), off = rand(-2.5, 2.5);
      return {
        on: false,
        a: { x: q.x - nx * w - K.sx * off - one.hx, y: q.y - ny * w - K.sy * off - one.hy },
        b: { x: q.x + nx * w + K.sx * off - two.hx, y: q.y + ny * w + K.sy * off - two.hy },
      };
    });
    K.whole.style.transform = `translate(${left}px,${top}px)`;
    K.whole.style.clipPath = 'polygon(0 0,0 0,0 0)';
    one.whole = K.whole;
    r.layer.append(K.whole);
    K.at = seamAt(K, 0.5 / n);
    s.knit = K;
    r.seams.push(K);
    zip(K, 0);
  }

  // shut as far as i of n. the halves open out from that point in a v that gets narrower as it gets shorter
  function zip(K, i) {
    const { T, W, H, v, one, two } = K, at = Math.round(K.a + (i / K.n) * (K.b - K.a)), P = T[at];
    if (i) {
      const cut = (v ? P.y : P.x).toFixed(1), rest = T.slice(at).map(p => `${p.x.toFixed(1)}px ${p.y.toFixed(1)}px`);
      const end = `${T.at(-1).x.toFixed(1)}px ${H + 20}px`;
      K.whole.style.clipPath = v ? `polygon(-20px -20px,${W + 20}px -20px,${W + 20}px ${cut}px,-20px ${cut}px)`
        : `polygon(-20px -20px,${cut}px -20px,${cut}px ${H + 20}px,-20px ${H + 20}px)`;
      one.node.style.clipPath = v ? `polygon(-20px ${cut}px,${rest},${end},-20px ${H + 20}px)`
        : `polygon(${cut}px -20px,${W + 20}px -20px,${[...rest].reverse()})`;
      two.node.style.clipPath = v ? `polygon(${W + 20}px ${cut}px,${rest},${end},${W + 20}px ${H + 20}px)`
        : `polygon(${rest},${W + 20}px ${H + 20}px,${cut}px ${H + 20}px)`;
    }
    const th = Math.atan2(K.open / 2, K.L) * (v ? -1 : 1) * (1 - i / K.n), px = K.left + P.x, py = K.top + P.y;
    for (const [A, a] of [[one, -th], [two, th]]) {
      const c = Math.cos(a), n = Math.sin(a), dx = A.hx - px, dy = A.hy - py;
      A.to = { x: px + c * dx - n * dy, y: py + n * dx + c * dy, a };
    }
  }

  function knit(r, s, dt) {
    const K = s.knit, needles = s.legs.filter(L => L.i === 0), both = [K.one, K.two];
    if (!K.on) {
      // both halves back at the opening and both front legs free
      if (needles.some(L => L.task) || both.some(A => Math.hypot(A.cx - A.to.x, A.cy - A.to.y) > 6)) return;
      K.on = true;
      r.threads = r.threads.filter(q => !both.includes(q.A));
      for (const A of both) A.reel = false;
      for (const L of needles) {
        L.step = null;
        L.task = { knit: true, c: K.c, from: { ...L.f }, turn: -1 };
      }
      return;
    }
    if (K.i < K.n) {
      // the legs have further to come for the first one
      K.p += dt / (K.i ? STITCH : 0.3);
      if (K.p >= 0.7 && !K.bars[K.i].on) {
        K.bars[K.i].on = true;
        lean(s, needles[K.i % 2], 0.2);
        say(s, `stitch(${K.i});`);
      }
      if (K.p < 1) return;
      K.p = 0;
      K.at = seamAt(K, (++K.i + 0.5) / K.n);
      return;
    }
    // all laced. the whole body goes into the pull, and the halves snap together behind it
    if (!K.y) {
      s.pitchV += 1.5;
      s.sagV += 40 * s.D.k;
      for (const A of both) A.snap = true;
      say(s, 'pull();');
    }
    K.y += dt / PULL;
    zip(K, Math.min(1, K.y) * K.n);
    if (K.y < 1.3) return;
    // shut. it's home now, and goes back to the real one
    K.done = r.t;
    for (const A of both) Object.assign(A, { to: null, cx: A.hx, cy: A.hy, a: 0, vx: 0, vy: 0, va: 0, mode: 'home' });
    for (const L of needles) L.task = { c: K.c, phase: 3, t: 0, from: { ...L.f } };
    s.knit = null;
  }

  // a front leg. it arcs over to its side of the next stitch and pokes through, then holds on for the pull, hauling back
  // towards the body
  function needle(s, L) {
    const K = s.knit, T = L.task, k = s.D.k;
    if (K.i >= K.n) {
      const e = ease(K.y / 0.7);
      L.f = { x: T.end.x + K.nx * K.side * 28 * k * e, y: T.end.y + K.ny * K.side * 28 * k * e, z: 8 * k * e };
      return;
    }
    if (T.turn !== K.i) { T.turn = K.i; T.from = { ...L.f }; }
    const bar = K.bars[K.i], first = (K.i % 2 === 0) === (L.side > 0), q = first ? onPiece(K.one, bar.a) : onPiece(K.two, bar.b);
    const p = Math.min(1, K.p / 0.7), e = p * p * (3 - 2 * p);
    L.f = { x: T.from.x + (q.x - T.from.x) * e, y: T.from.y + (q.y - T.from.y) * e, z: T.from.z * (1 - e) + Math.sin(Math.PI * p) * 14 * k };
    T.end = { ...L.f };
    if (!first) K.tip = L;
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
    const ch = Math.cos(E.h), sh = Math.sin(E.h), k = s.D.k;
    const cp = Math.cos(E.pitch), sp = Math.sin(E.pitch), cr = Math.cos(E.roll), sr = Math.sin(E.roll);
    // from the part's own frame: tipped, then rolled, then turned
    const tip = (u, v, z) => {
      const w = sp * u + cp * z;
      return [cp * u - sp * z, cr * v - sr * w, sr * v + cr * w];
    };
    const at = (u, v, z) => {
      const [a, b, c] = tip(u, v, z);
      return { x: E.o.x + ch * a - sh * b, y: E.o.y + sh * a + ch * b, z: E.o.z + c };
    };
    const surf = (th, ph) => [E.a * Math.cos(ph) * Math.cos(th), E.b * Math.cos(ph) * Math.sin(th), E.c * Math.sin(ph)];
    // the normal there, against the way the camera looks
    const faces = (u, v, z) => {
      const [a, b, c] = tip(u / (E.a * E.a), v / (E.b * E.b), z / (E.c * E.c));
      return (sh * a + ch * b) * PY + c > 0;
    };

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
      // what it's doing, in javascript, on the surface so it curves with it. each character turns with it too, the way up
      // is towards its tail so it reads right when it's walking down the page. a glitch scrambles a few
      const cw = 5.1 * k, lh = 9.4 * k, turn = E.h - Math.PI / 2, blink = Math.floor(s.t * 3) % 2;
      g.font = `bold ${Math.round(8 * k + 1)}px ${MONO}`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      s.code.slice(-ROWS).forEach((line, row, shown) => {
        const u = (row - (ROWS - 1) / 2) * lh, last = row === shown.length - 1, typed = last ? Math.min(line.text.length, Math.floor(s.typed)) : line.text.length;
        for (let i = 0; i <= typed; i++) {
          // the cursor sits after the last character
          const cursor = i === typed;
          if (cursor && !(last && blink)) break;
          const v = E.b * 0.78 - i * cw, d = (u / E.a) ** 2 + (v / E.b) ** 2;
          if (d > 0.9) continue;
          const q = P(at(u, v, E.c * Math.sqrt(1 - d)));
          g.save();
          g.translate(q.x, q.y);
          g.rotate(turn);
          g.fillStyle = tint || (cursor ? C.text : line.cols[i]);
          g.fillText(cursor ? '_' : s.glitch > 0 && Math.random() < 0.2 ? pick(GLYPHS) : line.text[i], 0, 0);
          g.restore();
        }
      });
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

  // its three parts. the thorax carries the legs, the abdomen and the head hang off it, each on a joint with its own turn
  // and tip. the abdomen's end is where the thread comes out
  function body(s) {
    const k = s.D.k, joint = (u, z) => local(s, u, 0, s.z + z + tiltZ(s, u, 0));
    const hang = (J, h, p, len) => ({ x: J.x + Math.cos(h) * Math.cos(p) * len, y: J.y + Math.sin(h) * Math.cos(p) * len, z: J.z + Math.sin(p) * len });
    const back = joint(-18 * k, 12 * k), neck = joint(28 * k, -2 * k);
    const tail = s.h + s.tail, dip = s.pitch * 0.5 + (s.belly - s.sag) / (32 * k), look = s.h + s.look, nod = s.pitch + s.nod;
    return [
      { o: hang(back, tail, dip, -32 * k), end: hang(back, tail, dip, -86 * k), h: tail, pitch: dip, roll: s.roll * 0.5, a: 54 * k, b: 39 * k, c: 32 * k, panel: true },
      { o: joint(10 * k, 0), h: s.h, pitch: s.pitch, roll: s.roll, a: 30 * k, b: 26 * k, c: 19 * k },
      { o: hang(neck, look, nod, 12 * k), h: look, pitch: nod, roll: s.roll, a: 15 * k, b: 16 * k, c: 12 * k, head: true },
    ];
  }

  function drawSpider(g, s, ox, tint) {
    g.save();
    g.translate(ox, 0);
    g.lineCap = g.lineJoin = 'round';
    // the legs on the far side first, then the body, then the near legs over it
    for (const L of s.legs) if (L.g.f.y < s.y) drawLeg(g, s, L, tint);
    // nearest last. the head sticks out in front, so it only goes behind the thorax when it's facing well away
    const parts = body(s), near = E => E.o.y * PY + E.o.z + (E.head ? 14 * s.D.k : 0);
    parts.sort((p, q) => near(p) - near(q));
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
    g.rotate(s.h + s.tail * 0.5);
    for (const [rx, ry, al] of [[78, 42, 0.14], [62, 32, 0.2]]) {
      g.fillStyle = `rgba(0,0,0,${al})`;
      g.beginPath();
      g.ellipse(0, 0, rx * k, ry * k, 0, 0, 7);
      g.fill();
    }
    g.restore();
  }


  // a glitch tears a few strips of it sideways, on screen
  function tear(r, s) {
    const g = r.ctx, d = r.dpr, k = s.D.k, sy = s.y + r.oy;
    g.setTransform(d, 0, 0, d, 0, 0);
    for (let i = 0; i < 2; i++) {
      const y = sy + rand(-140, 110) * k, h = rand(3, 14), x = Math.max(0, s.x - 230 * k), w = Math.min(r.W - x, 460 * k);
      if (y < 0 || y + h > r.H || w <= 0) continue;
      g.drawImage(r.canvas, x * d, y * d, w * d, h * d, x + rand(-16, 16), y, w, h);
    }
  }

  // ---------- the run

  function start() {
    if (run) return;
    const W = innerWidth, H = innerHeight;
    const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const mainTop = main.getBoundingClientRect().top, scroll0 = main.scrollTop, dy = scroll0 - mainTop;
    const b = bubble.getBoundingClientRect(), origin = { x: b.left + b.width / 2, y: b.top + b.height / 2 + dy };
    const h1 = document.querySelector('#s1 h1')?.getBoundingClientRect();
    const aim = h1?.height ? h1.top + h1.height * 0.55 + dy : origin.y;

    // the stand-ins for the words go in a layer inside the page's scroller, so they scroll with the rest of it. the
    // canvas for the spider and everything else drawn sits over the screen, follows the scroll itself and lets every
    // touch through, so the page scrolls like it always does. the wall canvas sits behind the page, the cracks are in
    // the wall
    const layer = el('div', 'position:absolute;left:0;top:0;width:0;height:0;z-index:2;pointer-events:none');
    const root = el('div', 'position:fixed;inset:0;z-index:50;overflow:hidden;pointer-events:none');
    const canvas = el('canvas', 'position:absolute;inset:0;width:100%;height:100%');
    const wall = el('canvas', 'position:fixed;inset:0;width:100%;height:100%;z-index:-1;pointer-events:none');
    const skip = el('button', `position:fixed;right:16px;bottom:16px;z-index:51;padding:10px 14px;border:0;`
      + `background:var(--frame-bcol);color:var(--text-grey);font:13px/1 ${MONO};cursor:pointer;opacity:0;`
      + (calm ? '' : 'transition:opacity .4s .8s'));
    skip.type = 'button';
    skip.textContent = '// skip';
    skip.setAttribute('aria-label', 'skip, put the site back together');
    skip.addEventListener('click', finish);
    root.setAttribute('aria-hidden', 'true');
    root.append(canvas);
    const dpr = devicePixelRatio || 1;
    for (const c of [canvas, wall]) { c.width = W * dpr; c.height = H * dpr; }
    const bg = document.getElementById('bg');

    run = {
      W, H, calm, origin, root, layer, canvas, wall, skip, dpr, ctx: canvas.getContext('2d'), wctx: wall.getContext('2d'),
      mainTop, dy, bottom: main.scrollHeight, maxScroll: main.scrollHeight - main.clientHeight, at: { snap: calm ? 0 : T_CRACK, spider: T_CRACK + T_SPIDER },
      view: { top: scroll0, bottom: scroll0 + H - mainTop }, oy: mainTop - scroll0, sh: { x: 0, y: 0 },
      cracks: [], actors: [], wrapped: [], clusters: [], parts: [], glyphs: [], threads: [], welds: [], seams: [],
      spider: null, silk: null, thud: 0, t: 0, user: -Infinity, expect: scroll0, healEnd: Infinity,
      phase: { x: rand(0, 9), y: rand(0, 9) }, t0: performance.now(), last: performance.now(),
      // the camera shake moves these, they get their own style back after
      shaken: [nav, main, bg].filter(Boolean).map(e => [e, e.getAttribute('style')]),
    };
    if (!calm) {
      // one crack across through the 🤓, and one to three running down the page from it
      const across = crackAcross(run, aim), n = Math.round(clamp(W / 450, 1, 3));
      run.cracks.push(across);
      for (let i = 0; i < n; i++) {
        const x = clamp((W * (i + 0.5)) / n + rand(-60, 60), 20, W - 20);
        run.cracks.push(crackDown(run, { x, y: crackAt(across, x) }));
      }
    }
    collect(run);
    group(run);
    if (calm) for (const A of run.actors) hit(run, A);
    main.append(layer);
    document.body.append(root, skip);
    (bg || document.body.firstChild).after(wall);
    getComputedStyle(skip).opacity;
    skip.style.opacity = '1';
    addEventListener('click', onClick, true);
    addEventListener('keydown', onKey, true);
    addEventListener('wheel', onInput, { passive: true });
    addEventListener('touchstart', onInput, { passive: true });
    addEventListener('resize', onResize);
    frame = requestAnimationFrame(tick);
  }

  // everything was measured for this width. a phone's bars sliding in and out only change the height, that's fine
  const onResize = () => run && innerWidth !== run.W && finish();
  // clicks don't reach the page while it's broken, so nothing opens and shoves the rest around mid fix
  const onClick = e => {
    if (!run || e.target === run.skip) return;
    e.preventDefault();
    e.stopPropagation();
  };
  // scrolling by hand stops the page following the spider for a bit
  const onInput = () => run && (run.user = run.t);
  function onKey(e) {
    if (e.key === 'Escape') return finish();
    if (SCROLL_KEYS.includes(e.key)) onInput();
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

  // when nobody's scrolled for a bit, the page follows the spider: once it wanders near the top or bottom of the
  // screen, it scrolls until it's a bit above the middle again
  function camera(r, dt) {
    const s = r.spider;
    if (!s || s.gone || s.leap?.exit || r.t - r.user < IDLE) return (r.follow = false);
    const h = r.H - r.mainTop, at = (s.y - r.view.top) / h;
    if (at < 0.15 || at > 0.72) r.follow = true;
    if (!r.follow) return;
    const want = clamp(s.y - h * 0.45, 0, r.maxScroll);
    if (Math.abs(want - r.view.top) < 6) return (r.follow = false);
    // where it asked to go is kept, reading the scroll back here would make the browser lay the page out again
    r.expect = Math.round(r.view.top + (want - r.view.top) * Math.min(1, dt * 2.4));
    main.scrollTo({ top: r.expect, behavior: 'instant' });
  }

  function tick(now) {
    const r = run, dt = Math.min(1 / 30, (now - r.last) / 1000);
    r.last = now;
    const t = (r.t = (now - r.t0) / 1000);
    // where the screen is on the page. a scroll the camera didn't make was someone scrolling
    const st = main.scrollTop;
    if (Math.abs(st - r.expect) > 1) r.user = t;
    r.expect = st;
    r.view.top = st;
    r.view.bottom = st + r.H - r.mainTop;
    // the camera moves first, from where the spider got to last frame. scrolling after this frame's changes would
    // make the browser lay the page out again just for that
    camera(r, dt);
    if (r.expect !== st) {
      r.view.top = r.expect;
      r.view.bottom = r.expect + r.H - r.mainTop;
    }
    r.oy = r.mainTop - r.view.top;
    r.thud *= Math.exp(-dt * 10);

    const sh = (r.sh = shake(r, t)), tf = `translate(${sh.x.toFixed(2)}px,${sh.y.toFixed(2)}px)`;
    for (const [e] of r.shaken) e.style.transform = tf;
    r.root.style.transform = r.wall.style.transform = tf;

    if (!r.calm && t >= r.at.snap && !r.snapped) {
      // the snap. the crack opens and spits bits of wall
      r.snapped = true;
      r.cracks[0].points.forEach((p, i) => i % 3 || chips(r, p.x, p.y, 2, 240, C.grey));
    }
    for (const A of r.actors) update(r, A, t, dt);
    if (!r.calm) flicker(r, t);

    if (r.calm) {
      // a group at a time, straight back
      r.clusters.forEach((c, i) => {
        if (c.taken || t < 0.6 + i * 0.05) return;
        c.taken = true;
        for (const A of c.members) handBack(A);
      });
    } else if (t >= r.at.spider) {
      const s = (r.spider ||= makeSpider(r));
      if (!s.gone) {
        updateSpider(r, dt);
        if (s.gone) {
          // it's left. whatever's somehow still broken goes back on its own, and the rest of the cracks zip shut
          // out from where it was
          for (const c of r.clusters) if (!c.taken) { c.taken = true; fix(r, c, null); }
          let end = r.t;
          for (const c of r.cracks) {
            c.points.forEach((p, i) => {
              if (c.close[i] === Infinity) c.close[i] = r.t + 0.2 + Math.hypot(p.x - s.x, p.y - s.y) / 2500;
              end = Math.max(end, c.close[i]);
            });
          }
          r.healEnd = end + 0.85;
        }
      }
    }

    drawWall(r, t);
    drawFx(r, t, dt);

    const settled = r.actors.every(A => A.mode === 'done');
    if (r.calm ? settled : (r.spider?.gone && settled && t > r.healEnd) || t > r.at.spider + 150) return finish();
    frame = requestAnimationFrame(tick);
  }

  // the cracks, behind the page, the part of them on screen. a bright hairline while the first one runs, then dark
  // gaps with a lit edge, widest at the 🤓. the ones down the page glow at the tip as they run. they close with a
  // stitch where the spider's been
  function drawWall(r, t) {
    if (r.calm) return;
    const busy = t < r.at.snap + 0.4 || r.cracks.some(c => c.show.some(v => t > v - 0.05 && t < v + 0.2) || c.close.some(v => t > v - 0.05 && t < v + 0.85));
    if (!busy && r.wallAt === r.view.top) return;
    r.wallAt = r.view.top;
    const g = r.wctx, top = r.view.top - r.mainTop - 80, bottom = r.view.bottom + 80;
    g.setTransform(r.dpr, 0, 0, r.dpr, 0, 0);
    g.clearRect(0, 0, r.W, r.H);
    g.translate(0, r.oy);
    g.lineCap = g.lineJoin = 'round';
    const path = (list, from, to) => {
      g.beginPath();
      for (let i = from; i <= to; i++) i === from ? g.moveTo(list[i].x, list[i].y) : g.lineTo(list[i].x, list[i].y);
    };
    if (t < r.at.snap) {
      const c = r.cracks[0], on = c.points.map((p, i) => t >= c.show[i]), from = on.indexOf(true), to = on.lastIndexOf(true);
      if (from < 0) return;
      g.strokeStyle = 'rgba(255,255,255,.85)';
      g.shadowColor = 'rgba(255,255,255,.7)';
      g.shadowBlur = 6;
      g.lineWidth = 1.3;
      path(c.points, from, to);
      g.stroke();
      g.lineWidth = 0.7;
      for (const b of c.branches) if (on[b.at]) { path(b.path, 0, b.path.length - 1); g.stroke(); }
      return;
    }
    g.font = `11px ${MONO}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    for (const c of r.cracks) {
      const pts = c.points;
      const open = i => (t < c.show[i] ? 0 : ease((t - Math.max(c.show[i], r.at.snap)) / 0.18) * (1 - ease((t - c.close[i]) / 0.18)));
      const o = pts.map((p, i) => open(i));
      // a gap opens down from a crack across, and sideways from one running down
      const [ux, uy] = c.dir === 'h' ? [0, 1] : [1, 0];
      const a = pts.map((p, i) => ({ x: p.x - ux * c.wide[i] * o[i] * 0.4, y: p.y - uy * c.wide[i] * o[i] * 0.4 }));
      const b = pts.map((p, i) => ({ x: p.x + ux * c.wide[i] * o[i] * 0.6, y: p.y + uy * c.wide[i] * o[i] * 0.6 }));
      const shown = i => (o[i - 1] > 0.02 || o[i] > 0.02) && Math.max(pts[i - 1].y, pts[i].y) > top && Math.min(pts[i - 1].y, pts[i].y) < bottom;
      for (const br of c.branches) {
        const k = o[br.at];
        if (k < 0.02 || br.path[0].y < top - 150 || br.path[0].y > bottom + 150) continue;
        g.globalAlpha = k;
        g.strokeStyle = 'rgba(255,255,255,.08)';
        g.lineWidth = 1;
        g.save();
        g.translate(0, 1);
        path(br.path, 0, br.path.length - 1);
        g.stroke();
        g.restore();
        g.strokeStyle = 'rgba(0,0,0,.6)';
        path(br.path, 0, br.path.length - 1);
        g.stroke();
      }
      g.globalAlpha = 1;
      g.beginPath();
      for (let i = 1; i < pts.length; i++) {
        if (!shown(i)) continue;
        g.moveTo(a[i - 1].x, a[i - 1].y);
        g.lineTo(a[i].x, a[i].y);
        g.lineTo(b[i].x, b[i].y);
        g.lineTo(b[i - 1].x, b[i - 1].y);
        g.closePath();
      }
      g.fillStyle = VOID_COL;
      g.fill();
      // its edges a bit at a time, so the parts closing fade out with it
      g.lineWidth = 1;
      for (let i = 1; i < pts.length; i++) {
        if (!shown(i)) continue;
        g.globalAlpha = Math.min(o[i - 1], o[i]);
        g.strokeStyle = 'rgba(0,0,0,.55)';
        path(a, i - 1, i);
        g.stroke();
        g.strokeStyle = 'rgba(255,255,255,.16)';
        path(b, i - 1, i);
        g.stroke();
      }
      g.globalAlpha = 1;
      pts.forEach((p, i) => {
        if (p.y < top || p.y > bottom) return;
        const age = t - c.show[i], shut = t - c.close[i];
        // the tip of one running down the page
        if (c.dir === 'v' && age >= 0 && age < 0.12) {
          g.fillStyle = '#fff';
          g.shadowColor = '#fff';
          g.shadowBlur = 8;
          g.fillRect(p.x - 1.5, p.y - 1.5, 3, 3);
          g.shadowBlur = 0;
        }
        // stitches where it's just closed, and the bright front of the closing
        if (shut < 0 || shut > 0.8) return;
        g.globalAlpha = 1 - shut / 0.8;
        g.fillStyle = C.tech;
        if (i % 2 === 0) g.fillText('x', p.x, p.y);
        if (shut < 0.08) {
          g.shadowColor = C.tech;
          g.shadowBlur = 10;
          g.fillRect(p.x - 2, p.y - 2, 4, 4);
          g.shadowBlur = 0;
        }
        g.globalAlpha = 1;
      });
    }
    // the snap's flash along the first one
    const flash = 1 - (t - r.at.snap) / 0.3;
    if (flash > 0) {
      g.strokeStyle = `rgba(255,255,255,${(flash * 0.9).toFixed(3)})`;
      g.shadowColor = 'rgba(255,255,255,.8)';
      g.shadowBlur = 10;
      g.lineWidth = 1.6;
      path(r.cracks[0].points, 0, r.cracks[0].points.length - 1);
      g.stroke();
      g.shadowBlur = 0;
    }
  }

  // everything drawn over the page, placed on the page and moved up by how far it's scrolled
  function drawFx(r, t, dt) {
    const g = r.ctx, s = r.spider && !r.spider.gone ? r.spider : null;
    g.setTransform(r.dpr, 0, 0, r.dpr, 0, 0);
    g.clearRect(0, 0, r.W, r.H);
    g.translate(0, r.oy);
    g.lineCap = g.lineJoin = 'round';
    if (s) {
      for (const L of s.legs) {
        const h = hipOf(s, L), { knee, foot } = knee3(h, L.f, L.L1, L.L2);
        L.g = { h, kn: knee, f: foot };
      }
      drawShadow(g, s);
    }

    // the characters a jab or a landing kicks out, slowing and fading
    r.glyphs = r.glyphs.filter(q => t - q.t < q.life);
    g.font = `11px ${MONO}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    for (const q of r.glyphs) {
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      q.vx *= Math.exp(-dt * 5);
      q.vy *= Math.exp(-dt * 5);
      g.globalAlpha = 1 - (t - q.t) / q.life;
      g.fillStyle = q.col;
      g.fillText(q.ch, q.x, q.y);
    }
    g.globalAlpha = 1;

    // the thread it jumps on, fading once it's landed
    if (s && r.silk && t < r.silk.until + 0.5) {
      const end = P(body(s)[0].end);
      g.globalAlpha = clamp(1 - (t - r.silk.until) / 0.5, 0, 1) * 0.75;
      g.strokeStyle = C.text;
      g.lineWidth = 1;
      line(g, r.silk, end);
      g.globalAlpha = 1;
    }

    // the stitches, across the tear with a hole at each end, and the free end of the thread back to the foot. each hangs
    // loose until the pull gets to it. a dark line under the thread so it shows on a pale picture
    r.seams = r.seams.filter(K => !K.done || t - K.done < 0.85);
    for (const K of r.seams) {
      const ends = K.bars.filter(bar => bar.on).map((bar, j) => ({
        a: onPiece(K.one, bar.a), b: onPiece(K.two, bar.b), loose: K.done ? 0 : 1 - clamp((K.y * K.n - j) / 1.5, 0, 1),
      }));
      g.globalAlpha = K.done ? clamp(1 - (t - K.done - 0.25) / 0.6, 0, 1) : 1;
      g.fillStyle = 'rgba(0,0,0,.7)';
      for (const { a, b } of ends) {
        for (const q of [a, b]) {
          g.beginPath();
          g.arc(q.x, q.y, 1.6, 0, 7);
          g.fill();
        }
      }
      for (const [col, w] of [['rgba(0,0,0,.6)', 2.8], [C.text, 1.4]]) {
        g.strokeStyle = col;
        g.lineWidth = w;
        g.beginPath();
        for (const { a, b, loose } of ends) {
          g.moveTo(a.x, a.y);
          g.quadraticCurveTo((a.x + b.x) / 2 + K.sx * loose * 7, (a.y + b.y) / 2 + K.sy * loose * 7, b.x, b.y);
        }
        if (K.tip && ends.length && !K.done) {
          const q = ends.at(-1).b, f = P(K.tip.g?.f || K.tip.f);
          g.moveTo(q.x, q.y);
          g.lineTo(f.x, f.y);
        }
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
        const drag = Math.exp(-dt * 3.5);
        q.vz -= 1100 * dt;
        q.vx *= drag;
        q.vy *= drag;
        q.x += q.vx * dt;
        q.y += q.vy * dt;
        q.z += q.vz * dt;
        if (q.z < 0) { q.z = 0; q.vz *= -0.4; q.vx *= 0.6; q.vy *= 0.6; }
        if (q.fork && q.life < q.fork) {
          q.fork = 0;
          for (let i = 0; i < 2; i++) {
            r.parts.push({ ...q, vx: q.vx * 0.7 + rand(-110, 110), vy: q.vy * 0.7 + rand(-110, 110), vz: q.vz * 0.7 + rand(-60, 90), life: q.life * rand(0.5, 0.9) });
          }
        }
        // no blur. a spark is a thin streak as long as it travels in a blink, so the fast ones are long, with a faint tail
        // and a hot head. it cools as it goes and twinkles, and sparks add up to white where they cross
        const head = P(q), tail = P({ x: q.x - q.vx * BLINK, y: q.y - q.vy * BLINK, z: Math.max(0, q.z - q.vz * BLINK) });
        const fade = g.globalAlpha * rand(0.7, 1);
        g.globalCompositeOperation = 'lighter';
        g.strokeStyle = HEAT[Math.round((1 - q.life / q.max) * 32)];
        g.globalAlpha = fade * 0.45;
        g.lineWidth = 1;
        line(g, tail, head);
        g.globalAlpha = fade;
        g.lineWidth = 1.5;
        line(g, { x: head.x + (tail.x - head.x) * 0.4, y: head.y + (tail.y - head.y) * 0.4 }, head);
        g.globalCompositeOperation = 'source-over';
        continue;
      }
      q.vy += GRAVITY * 0.8 * dt;
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      g.fillStyle = q.col;
      g.fillRect(q.x, q.y, q.s, q.s);
    }
    g.globalAlpha = 1;

    // a ripped word or the 🤓 coming back together: a thin hot line along the tear that cools and goes, no blur
    r.welds = r.welds.filter(w => t - w.t < 0.4);
    for (const w of r.welds) {
      const p = (t - w.t) / 0.4;
      g.globalAlpha = 1 - p;
      g.strokeStyle = HEAT[Math.round(p * 32)];
      g.lineWidth = 1;
      g.beginPath();
      w.pts.forEach((q, i) => (i ? g.lineTo(q.x, q.y) : g.moveTo(q.x, q.y)));
      g.stroke();
    }
    g.globalAlpha = 1;

    // the spider, if it's anywhere near the screen
    if (!s || s.y + r.oy < -400 || s.y + r.oy > r.H + 400) return;
    if (s.glitch > 0) {
      g.globalCompositeOperation = 'lighter';
      drawSpider(g, s, -3, 'rgba(255,50,90,.6)');
      drawSpider(g, s, 3, 'rgba(50,240,255,.6)');
      g.globalCompositeOperation = 'source-over';
    }
    drawSpider(g, s, 0, null);
    if (s.glitch > 0) tear(r, s);
  }

  // the page as it was, everything gone. skipping comes here too. the scroll stays wherever it is
  function finish() {
    if (!run) return;
    const r = run;
    run = null;
    cancelAnimationFrame(frame);
    for (const A of r.actors) {
      if (A.own) { if (A.mode !== 'done') release(A.node, A.style0); }
      // a torn picture or 🤓, hidden behind its copies
      else if (!A.text) restoreStyle(A.span, A.style0);
    }
    for (const { n, parts } of r.wrapped) {
      if (!parts[0].isConnected) continue;
      parts[0].before(n);
      for (const p of parts) p.remove();
    }
    for (const [e, style] of r.shaken) restoreStyle(e, style);
    for (const e of [r.layer, r.root, r.skip, r.wall]) e.remove();
    removeEventListener('click', onClick, true);
    removeEventListener('keydown', onKey, true);
    removeEventListener('wheel', onInput);
    removeEventListener('touchstart', onInput);
    removeEventListener('resize', onResize);
  }

  // main.js calls this on every click after the first
  window.breakdown = start;
  start();
})();
