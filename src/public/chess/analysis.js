// analysis board. rules and san from lib/chess.js, the board is our own, the engine is a uci web worker (engines/)
import { Chess } from './lib/chess.js';

// folders under engines/, the same glue around a different net
const ENGINES = ['v31', 'mixall512'];
const START = new Chess().fen(), FILES = 'abcdefgh';
// arrow colours like lichess: right drag is green, shift red, alt blue, both yellow. the engine arrow is blue
const BRUSH = { g: '#15781b', r: '#882020', b: '#003088', y: '#e68f00' };
const INFO = /^info depth (\d+) score (cp|mate) (-?\d+) .*?nps (\d+) .*?pv ?(.*)/;

const el = Object.fromEntries([...document.querySelectorAll('[id]')].map(e => [e.id, e]));
let root, cur, game, nodes, flipped = false, sel = null, dests = new Map(), drag = null, draw = null;
let engine = ENGINES[0], worker = null, timer, ev = null;

// a node is a position: the move that made it, its fen and the lines after it, children[0] is the main one
function newRoot(fen) {
  const g = new Chess(fen);
  root = { id: 0, fen: g.fen(), ply: (g.moveNumber() - 1) * 2 + (g.turn() === 'b'), children: [], shapes: [] };
  nodes = [root];
}

const uciMove = u => ({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] });

// the child of n after a uci move, made if new. throws on an illegal one
function child(n, uci) {
  const g = new Chess(n.fen), m = g.move(uciMove(uci));
  let c = n.children.find(c => c.uci === m.lan);
  if (!c) {
    c = { id: nodes.length, parent: n, uci: m.lan, san: m.san, fen: g.fen(), ply: n.ply + 1, children: [], shapes: [] };
    n.children.push(c);
    nodes.push(c);
  }
  return c;
}

const path = n => n.parent ? [...path(n.parent), n.uci] : [];
// move number before a move played from ply p: "12." for white, "12…" for black
const num = (p, dots = '…') => Math.floor(p / 2) + 1 + (p % 2 ? dots : '.');

// screen column and row (0..7 from the top left) of a square, and back
const xy = sq => { const f = FILES.indexOf(sq[0]), r = sq[1] - 1; return flipped ? [7 - f, r] : [f, 7 - r]; };
const at = (x, y) => flipped ? FILES[7 - x] + (y + 1) : FILES[x] + (8 - y);
const pos = sq => { const [x, y] = xy(sq); return `translate(${x * 100}%,${y * 100}%)`; };
const img = kind => `url(/chess/pieces/${kind}.svg)`;

function sqAt(e) {
  const r = el.board.getBoundingClientRect();
  const x = Math.floor((e.clientX - r.left) / r.width * 8), y = Math.floor((e.clientY - r.top) / r.height * 8);
  return x >= 0 && x < 8 && y >= 0 && y < 8 ? at(x, y) : null;
}

// moves animate because piece elements get reused: one already in place stays, otherwise the nearest leftover of
// the same kind slides over. new ones appear, captured ones fade out
function syncPieces(fresh) {
  if (fresh) el.pieces.replaceChildren();
  const left = [...el.pieces.querySelectorAll('.piece:not(.gone)')], todo = [];
  for (const p of game.board().flat()) {
    if (!p) continue;
    const kind = p.color + p.type, i = left.findIndex(e => e.dataset.sq === p.square && e.dataset.kind === kind);
    if (i < 0) todo.push([p.square, kind]);
    else left.splice(i, 1)[0].style.transform = pos(p.square);
  }
  const dist = (a, b) => { const [ax, ay] = xy(a), [bx, by] = xy(b); return Math.hypot(ax - bx, ay - by); };
  for (const [sq, kind] of todo) {
    let e = null;
    for (const c of left) if (c.dataset.kind === kind && (!e || dist(c.dataset.sq, sq) < dist(e.dataset.sq, sq))) e = c;
    if (e) left.splice(left.indexOf(e), 1);
    else {
      e = document.createElement('div');
      e.className = 'piece';
      e.dataset.kind = kind;
      e.style.backgroundImage = img(kind);
      el.pieces.append(e);
    }
    e.dataset.sq = sq;
    e.style.transform = pos(sq);
  }
  for (const e of left) { e.classList.add('gone'); setTimeout(() => e.remove(), 200); }
}

function drawSquares() {
  const marks = [];
  if (cur.uci) marks.push([cur.uci.slice(0, 2), 'last'], [cur.uci.slice(2, 4), 'last']);
  if (game.inCheck()) marks.push([game.findPiece({ type: 'k', color: game.turn() })[0], 'check']);
  if (sel) marks.push([sel, 'sel'], ...[...dests].map(([sq, cap]) => [sq, cap ? 'dest cap' : 'dest']));
  if (drag?.over && dests.has(drag.over)) marks.push([drag.over, 'hover']);
  el.squares.innerHTML = marks.map(([sq, c]) => `<i class="${c}" style="transform:${pos(sq)}"></i>`).join('');
}

function drawShapes() {
  const list = [...cur.shapes];
  if (draw) list.push(draw);
  if (ev?.pv[0]) list.push({ from: ev.pv[0].slice(0, 2), to: ev.pv[0].slice(2, 4), color: 'b', engine: true });
  el.shapes.lastChild.innerHTML = list.map(s => {
    const [x1, y1] = xy(s.from).map(v => v + .5), [x2, y2] = xy(s.to).map(v => v + .5), c = BRUSH[s.color];
    if (s.from === s.to) return `<circle cx="${x1}" cy="${y1}" r=".46" fill="none" stroke="${c}" stroke-width=".0625" opacity=".8"/>`;
    // pulled back by one line width so the head's tip lands on the centre
    const w = s.engine ? .23 : .16, k = 1 - w / Math.hypot(x2 - x1, y2 - y1);
    return `<line x1="${x1}" y1="${y1}" x2="${x1 + (x2 - x1) * k}" y2="${y1 + (y2 - y1) * k}" stroke="${c}" stroke-width="${w}"
      stroke-linecap="round" marker-end="url(#h-${s.color})" opacity="${s.engine ? .45 : .8}"/>`;
  }).join('');
}

function drawBoard(fresh) { syncPieces(fresh); drawSquares(); drawShapes(); }

function orient() {
  // the right column and bottom row start dark on even i, so odd i sits on a light square
  el.coords.innerHTML = Array.from({ length: 8 }, (_, i) => {
    const lt = i % 2 ? ' lt' : '';
    return `<span class="rank${lt}" style="top:${i * 12.5}%">${at(7, i)[1]}</span><span class="file${lt}" style="left:${i * 12.5}%">${at(i, 7)[0]}</span>`;
  }).join('');
  el.gauge.classList.toggle('flip', flipped);
}

function select(sq) {
  sel = sq;
  dests = new Map(sq ? game.moves({ square: sq, verbose: true }).map(m => [m.to, !!m.captured]) : []);
  drawSquares();
}

// a move made on the board, a pawn reaching the last rank asks for the piece first
function tryMove(from, to) {
  select(null);
  if (game.moves({ square: from, verbose: true }).some(m => m.to === to && m.promotion)) promote(from, to);
  else goto(child(cur, from + to));
}

// q n r b in a column from the promotion square inward like lichess, a click anywhere else cancels
function promote(from, to) {
  const [x, y] = xy(to);
  el.promo.innerHTML = [...'qnrb'].map((p, i) => `<div class="piece" data-p="${p}"
    style="background-image:${img(game.turn() + p)};transform:translate(${x * 100}%,${(y ? y - i : i) * 100}%)"></div>`).join('');
  el.promo.hidden = false;
  el.promo.onpointerdown = e => {
    e.stopPropagation();
    el.promo.hidden = true;
    const p = e.target.dataset.p;
    p ? goto(child(cur, from + to + p)) : drawBoard();
  };
}

// side lines as text: n, then its main continuation. alternatives to a move go in brackets right after it, the ones
// to n itself only when n is its parent's first child, otherwise whoever printed n prints them
function line(n, fmt) {
  let s = '', label = true;
  for (; n; n = n.children[0]) {
    s += fmt(n, label || n.parent.ply % 2 === 0) + ' ';
    const alts = n === n.parent.children[0] ? n.parent.children.slice(1) : [];
    for (const a of alts) s += `(${line(a, fmt)}) `;
    label = alts.length > 0;
  }
  return s.trim();
}

const mvHtml = (n, label) =>
  `<span class="mv${n === cur ? ' cur' : ''}" data-id="${n.id}">${label ? num(n.parent.ply) + ' ' : ''}${n.san}</span>`;

// the main line as a two column table like lichess, side lines break it with a block of text
function drawMoves() {
  let h = '', gap = true;
  for (let n = root.children[0]; n; n = n.children[0]) {
    const p = n.parent.ply, white = p % 2 === 0, alts = n.parent.children.slice(1);
    if (white || gap) h += `<b>${Math.floor(p / 2) + 1}</b>` + (white ? '' : '<i>…</i>');
    h += mvHtml(n, false);
    if (alts.length) h += (white ? '<i>…</i>' : '') + `<div class="vars">${alts.map(a => `<div>${line(a, mvHtml)}</div>`).join('')}</div>`;
    gap = alts.length > 0;
  }
  el.moves.innerHTML = h;
  const c = el.moves.querySelector('.cur');
  el.moves.scrollTop = c ? c.offsetTop - el.moves.clientHeight / 2 : 0;
}

function pgn() {
  const head = root.fen === START ? '' : `[SetUp "1"]\n[FEN "${root.fen}"]\n\n`;
  const body = root.children[0] ? line(root.children[0], (n, label) => (label ? num(n.parent.ply, '...') + ' ' : '') + n.san) + ' ' : '';
  return head + body + '*';
}

const winning = cp => 2 / (1 + Math.exp(-0.00368208 * cp)) - 1;  // lichess's winning chances, -1..1

function drawEval() {
  const end = game.isCheckmate() ? 'checkmate' : game.isStalemate() ? 'stalemate'
    : game.isInsufficientMaterial() ? 'insufficient material' : game.isDraw() ? 'fifty moves' : '';
  let white = null, score = '', info = el.on.checked ? 'thinking' : 'engine off';  // white: white's share of the gauge
  if (end) {
    white = end === 'checkmate' ? +(game.turn() === 'b') : .5;
    score = ['0-1', '½-½', '1-0'][white * 2];
    info = end;
  } else if (ev) {
    const e = Math.round(ev.cp / 10) / 10;
    white = ev.mate != null ? +(ev.mate > 0) : (1 + winning(ev.cp)) / 2;
    score = ev.mate != null ? '#' + ev.mate : (e > 0 ? '+' : '') + e.toFixed(1);
    info = `depth ${ev.depth} · ${Math.round(ev.nps / 1000).toLocaleString()} kn/s`;
  }
  el.score.textContent = score;
  el.info.textContent = info;
  if (white !== null) el.gaugeW.style.height = white * 100 + '%';
  // the engine line in san, each move clickable
  const g = ev && new Chess(cur.fen);
  el.pv.innerHTML = !ev ? '' : ev.pv.map((u, i) => {
    const p = cur.ply + i, m = g.move(uciMove(u));
    return `<span data-i="${i}">${!i || p % 2 === 0 ? num(p) + ' ' : ''}${m.san}</span>`;
  }).join(' ');
}

// avy: the wasm build can't take a stop mid search, so a new position kills the worker and starts a fresh one (~80ms,
// the compiled wasm is cached) and the hash goes with it. a pthreads build with stop would keep one worker. the wait
// lets arrow keys skim through moves without spinning one up for each
function analyse() {
  clearTimeout(timer);
  worker?.terminate();
  worker = ev = null;
  drawEval();
  drawShapes();
  if (!el.on.checked || game.isGameOver()) return;
  timer = setTimeout(() => {
    const n = cur, w = worker = new Worker(`/chess/engines/${engine}/engine.worker.js`), sign = n.ply % 2 ? -1 : 1;
    w.onmessage = e => {
      const m = INFO.exec(e.data);
      if (!m || w !== worker) return;
      ev = { depth: +m[1], [m[2]]: m[3] * sign, nps: +m[4], pv: m[5].split(' ').filter(Boolean) };  // white's view
      drawEval();
      drawShapes();
    };
    w.onerror = () => { el.info.textContent = 'engine failed to load'; };
    w.postMessage(`position fen ${root.fen} moves ${path(n).join(' ')}`);
    w.postMessage('go movetime 30000');  // capped so an idle tab doesn't spin the fan forever
  }, 150);
}

function goto(n) {
  cur = n;
  game = new Chess(n.fen);
  sel = null;
  dests = new Map();
  syncPieces();
  drawSquares();
  analyse();
  drawMoves();
  el.fen.value = n.fen;
  if (document.activeElement !== el.pgn) el.pgn.value = pgn();
  el.fen.classList.remove('bad');
  el.pgn.classList.remove('bad');
  history.replaceState(null, '', n.fen === START ? location.pathname : '#' + n.fen.replaceAll(' ', '_'));
}

el.board.oncontextmenu = e => e.preventDefault();
el.board.onpointerdown = e => {
  const sq = sqAt(e);
  if (!sq) return;
  el.board.setPointerCapture(e.pointerId);
  if (e.button === 2) {
    draw = { from: sq, to: sq, color: 'grby'[(e.shiftKey || e.ctrlKey) + 2 * (e.altKey || e.metaKey)] };
    return drawShapes();
  }
  if (e.button !== 0) return;
  if (cur.shapes.length) { cur.shapes = []; drawShapes(); }
  if (dests.has(sq)) return tryMove(sel, sq);
  if (game.get(sq)?.color !== game.turn()) return select(null);
  drag = { from: sq, el: el.pieces.querySelector(`.piece:not(.gone)[data-sq="${sq}"]`), x: e.clientX, y: e.clientY, wasSel: sel === sq };
  select(sq);
};
el.board.onpointermove = e => {
  const sq = sqAt(e);
  if (draw) {
    if (sq && sq !== draw.to) { draw.to = sq; drawShapes(); }
    return;
  }
  if (!drag || !drag.on && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 4) return;
  const r = el.board.getBoundingClientRect(), half = r.width / 16;
  drag.on = true;
  drag.el.classList.add('drag');
  drag.el.style.transform = `translate(${e.clientX - r.left - half}px,${e.clientY - r.top - half}px)`;
  if (sq !== drag.over) { drag.over = sq; drawSquares(); }
};
el.board.onpointerup = e => {
  if (draw) {
    // the same arrow again removes it, another colour replaces it
    const old = cur.shapes.find(s => s.from === draw.from && s.to === draw.to);
    cur.shapes = cur.shapes.filter(s => s !== old);
    if (old?.color !== draw.color) cur.shapes.push(draw);
    draw = null;
    return drawShapes();
  }
  if (!drag) return;
  const d = drag, sq = sqAt(e);
  drag = null;
  d.el.classList.remove('drag');
  if (sq !== d.from && dests.has(sq)) return tryMove(d.from, sq);
  if (sq === d.from && d.wasSel && !d.on) select(null);
  drawBoard();
};
el.board.onpointercancel = () => {
  drag?.el.classList.remove('drag');
  drag = draw = null;
  drawBoard();
};

const lineEnd = () => { let n = cur; while (n.children[0]) n = n.children[0]; return n; };
const keys = {
  ArrowLeft: () => cur.parent, ArrowRight: () => cur.children[0],
  ArrowUp: () => root, Home: () => root, ArrowDown: lineEnd, End: lineEnd,
  ' ': () => ev?.pv[0] && child(cur, ev.pv[0]),
  f: () => { flipped = !flipped; orient(); drawBoard(true); },
  l: () => el.on.click(),
};
const press = k => { const n = keys[k](); if (n) goto(n); };
onkeydown = e => {
  if (!keys[e.key] || e.ctrlKey || e.metaKey || e.altKey || e.target.matches('input, textarea, select')) return;
  e.preventDefault();
  press(e.key);
};
el.ctrl.onmousedown = e => e.preventDefault();  // the buttons take no focus, so space stays "play the best move"
el.ctrl.onclick = e => { const k = e.target.closest('button')?.dataset.key; if (k) press(k); };
el.moves.onclick = e => { const id = e.target.dataset.id; if (id) goto(nodes[id]); };
el.pv.onclick = e => {
  const i = e.target.dataset.i;
  if (!i) return;
  let n = cur;
  for (const u of ev.pv.slice(0, +i + 1)) n = child(n, u);
  goto(n);
};

el.on.onchange = () => { document.body.classList.toggle('off', !el.on.checked); analyse(); };
el.engine.innerHTML = ENGINES.map(e => `<option>${e}</option>`).join('');
try { if (ENGINES.includes(localStorage.chessEngine)) engine = localStorage.chessEngine; } catch {}
el.engine.value = engine;
el.engine.onchange = () => {
  engine = el.engine.value;
  try { localStorage.chessEngine = engine; } catch {}
  el.engine.blur();
  analyse();
};

el.fen.onchange = () => {
  try { newRoot(el.fen.value.trim()); goto(root); } catch { el.fen.classList.add('bad'); }
};
// avy: chess.js only keeps the main line of a pgn, so side lines don't come in (they do go out, see pgn())
el.load.onclick = () => {
  try {
    const g = new Chess();
    g.loadPgn(el.pgn.value);
    const h = g.history({ verbose: true });
    newRoot(h.length ? h[0].before : g.fen());
    let n = root;
    for (const m of h) n = child(n, m.lan);
    goto(root);
  } catch { el.pgn.classList.add('bad'); }
};

el.shapes.innerHTML = `<defs>${Object.entries(BRUSH).map(([k, c]) =>
  `<marker id="h-${k}" orient="auto" markerWidth="4" markerHeight="4" refX="2.05" refY="2"><path d="M0,0V4L3,2Z" fill="${c}"/></marker>`).join('')}</defs><g></g>`;
try { newRoot(decodeURIComponent(location.hash.slice(1)).replaceAll('_', ' ') || START); } catch { newRoot(START); }
orient();
goto(root);
