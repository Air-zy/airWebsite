// analysis board. rules and san from lib/chess.js, the board is our own, the engine is a uci web worker (engines/)
import { Chess } from './lib/chess.js';

// the ?v= chess.html loads this with (a hash of the chess files, config/site.js), passed on to what this loads so a
// cached old copy of any of them isn't mixed with a new page
const V = new URL(import.meta.url).search;

const START = new Chess().fen(), FILES = 'abcdefgh';
const NAMES = { k: 'king', q: 'queen', r: 'rook', b: 'bishop', n: 'knight', p: 'pawn' };
// arrow colours like lichess: right drag is green, shift red, alt blue, both yellow. the engine's best line is blue and
// its other lines grey
const BRUSH = { g: '#15781b', r: '#882020', b: '#003088', y: '#e68f00', k: '#4a4a4a' };
// verity's fight player prints no nps, just the depth, score and its move. seldepth (the deepest ply the search reached,
// captures and checks included) is optional too, an engine that prints it gets "depth 10/18" in the panel
const INFO = /^info depth (\d+)(?: seldepth (\d+))?(?: multipv (\d+))? score (cp|mate) (-?\d+)(?: .*?nps (\d+))? .*?pv ?(.*)/;
const BEST = /^bestmove (\S+)/;
// the king and rook squares each castling flag needs
const CASTLE = { K: ['e1', 'h1'], Q: ['e1', 'a1'], k: ['e8', 'h8'], q: ['e8', 'a8'] };
// review: how deep each position is searched. 12, but cynical's human net makes every node several times slower: a 26
// move game took 29s at its 7 (59s at 8) where gojo's 12 took 3s
const DEPTH = { cynical: 7 };
// the grades, in the stats' order: their sign and name
const GRADES = { brilliant: ['!!', 'brilliant'], great: ['!', 'great move'], inaccuracy: ['?!', 'inaccuracy'], mistake: ['?', 'mistake'],
  blunder: ['??', 'blunder'], miss: ['X', 'missed win'] };
const VALUE = { p: 1, n: 3, b: 3, r: 5, q: 9 }, SIDE = { w: 'white', b: 'black' }, other = c => c === 'w' ? 'b' : 'w';

const el = Object.fromEntries([...document.querySelectorAll('[id]')].map(e => [e.id, e]));
let root, cur, game, nodes, flipped = false, sel = null, dests = new Map(), drag = null, draw = null;
// your side in a fight. a fight starts with the bottom side, then only the fight bar's toggle changes it (el.sideBtn),
// flipping the board just turns the view. the fight's clocks (null without) and your premoves, [{ from, to }] in order
let side = 'w', clock = null, pres = [];
let worker = null, reviewer = null, timer, pvs = [], mode = '';  // pvs: the engine's lines, best first. mode: '', 'fight' or 'edit'
// edit mode: the position being edited (it may not be legal yet), the palette tool ('' the hand, 'x' the eraser or a
// piece like 'wn') and what a held pointer paints (null when nothing, '' when erasing)
let edit = null, tool = '', brush = null, brushed;

// in a fight the engine plays the other side when it's that side's turn at the end of a line, so stepping back through
// the game doesn't make it move. without hints nothing runs on your move and its line and arrow stay hidden
const blind = () => mode === 'fight' && !el.hints.checked;
const engineMoves = () => mode === 'fight' && game.turn() !== side && !cur.children.length && !clock?.flag;
// lines the engine searches: one when it plays the move, never more than there are moves (it prints just that many).
// ONE searches one line whatever MultiPV says, so the panel waiting for a second line never showed it
const ONE = ['suimate'];
const want = () => engineMoves() || ONE.includes(el.engine.value) ? 1 : Math.min(el.multipv.value, game.moves().length);

// a node is a position: the move that made it, its fen and the lines after it, children[0] is the main one
function newRoot(fen) {
  const err = fenError(fen);
  if (err) throw new Error(err);
  resetReview();
  if (mode === 'fight') resetClock();
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
// n and its main continuation
const walk = n => { const l = [n]; while (n.children[0]) l.push(n = n.children[0]); return l; };
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
function syncPieces(fresh, box = el.pieces, g = edit || (pres.length ? planned() : game)) {
  if (fresh) box.replaceChildren();
  const left = [...box.querySelectorAll('.piece:not(.gone)')], todo = [];
  for (const p of g.board().flat()) {
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
      box.append(e);
    }
    e.dataset.sq = sq;
    e.style.transform = pos(sq);
  }
  for (const e of left) { e.classList.add('gone'); setTimeout(() => e.remove(), 200); }
}

// square highlights: the move that led to g and a king in check, then any extra [square, class] on top
function marks(uci, g, extra = []) {
  const m = uci ? [[uci.slice(0, 2), 'last'], [uci.slice(2, 4), 'last']] : [];
  if (g.inCheck()) m.push([g.findPiece({ type: 'k', color: g.turn() })[0], 'check']);
  return [...m, ...extra].map(([sq, c]) => `<i class="${c}" style="transform:${pos(sq)}"></i>`).join('');
}

// the current move's grade on its square while reviewing (chess.html, #tags), redrawn only when it changes
let tagged = '';
function drawTag() {
  const g = reviewing() && !edit && cur.score?.grade, key = g ? `${cur.id} ${g} ${flipped}` : '';
  if (key === tagged) return;
  tagged = key;
  el.tags.innerHTML = g ? `<div style="transform:${pos(cur.uci.slice(2, 4))}">${badge(g)}</div>` : '';
}

function drawSquares() {
  drawTag();
  if (edit) return el.squares.replaceChildren();
  // each premove's squares once, a square two premoves share would show darker
  const extra = [...new Set(pres.flatMap(p => [p.from, p.to]))].map(sq => [sq, 'pre']);
  if (sel) extra.push([sel, 'sel'], ...[...dests].map(([sq, cap]) => [sq, cap ? 'dest cap' : 'dest']));
  if (drag?.over && dests.has(drag.over)) extra.push([drag.over, 'hover']);
  el.squares.innerHTML = marks(cur.uci, game, extra);
}

function drawShapes() {
  const list = [...cur.shapes];
  if (draw) list.push(draw);
  // lichess's engine arrows: the best line's, under it the other lines' that give away less than a fifth of the win
  // chance, thinner the more they give away. drawn worst first so the best ends on top
  if (!blind()) for (const [i, l] of [...pvs.entries()].reverse()) {
    const shift = (game.turn() === 'w' ? 1 : -1) * (chance(pvs[0]) - chance(l)) / 2;
    if (i && shift >= .2) continue;
    list.push({ from: l.pv[0].slice(0, 2), to: l.pv[0].slice(2, 4), ...i ? { color: 'k', w: (12 - shift * 50) / 64, o: .35 } : { color: 'b', w: .23, o: .45 } });
  }
  el.shapes.lastChild.innerHTML = list.map(s => {
    const [x1, y1] = xy(s.from).map(v => v + .5), [x2, y2] = xy(s.to).map(v => v + .5), c = BRUSH[s.color];
    if (s.from === s.to) return `<circle cx="${x1}" cy="${y1}" r=".46" fill="none" stroke="${c}" stroke-width=".0625" opacity=".8"/>`;
    // pulled back by one line width so the head's tip lands on the centre
    const w = s.w ?? .16, k = 1 - w / Math.hypot(x2 - x1, y2 - y1);
    return `<line x1="${x1}" y1="${y1}" x2="${x1 + (x2 - x1) * k}" y2="${y1 + (y2 - y1) * k}" stroke="${c}" stroke-width="${w}"
      stroke-linecap="round" marker-end="url(#h-${s.color})" opacity="${s.o ?? .8}"/>`;
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

function drawSide() {
  el.side.textContent = side === 'b' ? 'black' : 'white';
  el.sideKing.style.backgroundImage = img(side + 'k');
}

// a piece picked up: its legal moves, or premoving (on the engine's turn) every square it could reach on an empty board
// from where your premoves so far leave it, since the engine's moves may still open or close any of them
let premoving = false;
function select(sq, early = false) {
  sel = sq;
  premoving = !!sq && early;
  dests = !sq ? new Map() : premoving ? reach(sq, planned()) : new Map(game.moves({ square: sq, verbose: true }).map(m => [m.to, !!m.captured]));
  drawSquares();
}

// the board as your premoves leave it, like chess.com shows it: each played in turn from the real position with the
// engine's replies left out. a king's two-square move takes its rook along, a pawn reaching the last rank queens
function planned() {
  const f = game.fen().split(' ');
  f[1] = side;
  f[3] = '-';
  const g = new Chess(f.join(' '), { skipValidation: true });
  for (const p of pres) {
    const piece = g.get(p.from);
    if (!piece) break;
    g.remove(p.from);
    if (piece.type === 'k' && Math.abs(FILES.indexOf(p.to[0]) - FILES.indexOf(p.from[0])) === 2) {
      const r = p.from[1], rook = g.get((p.to[0] === 'g' ? 'h' : 'a') + r);
      if (rook?.type === 'r') { g.remove((p.to[0] === 'g' ? 'h' : 'a') + r); g.put(rook, (p.to[0] === 'g' ? 'f' : 'd') + r); }
    }
    g.put(piece.type === 'p' && /[18]/.test(p.to[1]) ? { type: 'q', color: piece.color } : piece, p.to);
  }
  return g;
}

// where the piece on sq in g could go on an empty board, castling and pawn captures included, like lichess's premoves
const JUMPS = [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]];
function reach(sq, g) {
  const p = g.get(sq), f = FILES.indexOf(sq[0]), r = +sq[1], out = new Map();
  const add = (x, y) => x >= 0 && x < 8 && y >= 1 && y <= 8 && out.set(FILES[x] + y, false);
  const rays = dirs => { for (const [dx, dy] of dirs) for (let i = 1; i < 8; i++) add(f + dx * i, r + dy * i); };
  if (p.type === 'n') for (const [dx, dy] of JUMPS) add(f + dx, r + dy);
  if ('bq'.includes(p.type)) rays(RAYS.b);
  if ('rq'.includes(p.type)) rays(RAYS.r);
  if (p.type === 'k') {
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) if (dx || dy) add(f + dx, r + dy);
    if (sq === (p.color === 'w' ? 'e1' : 'e8')) { add(f + 2, r); add(f - 2, r); }
  }
  if (p.type === 'p') {
    const d = p.color === 'w' ? 1 : -1;
    add(f, r + d);
    if (r === (p.color === 'w' ? 2 : 7)) add(f, r + 2 * d);
    add(f - 1, r + d);
    add(f + 1, r + d);
  }
  return out;
}

// a move made on the board, a pawn reaching the last rank asks for the piece first. on the engine's turn it's a
// premove instead, queued after any others. the board redraws as the premoves leave it (planned), which also puts a
// dragged piece where it belongs
function tryMove(from, to) {
  const early = premoving;
  select(null);
  if (early) { pres.push({ from, to }); play('premove'); return drawBoard(); }
  if (game.moves({ square: from, verbose: true }).some(m => m.to === to && m.promotion)) promote(from, to);
  else goto(child(cur, from + to), true);
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
    p ? goto(child(cur, from + to + p), true) : drawBoard();
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

const badge = g => `<em class="g ${g}" title="${GRADES[g][1]}">${GRADES[g][0]}</em>`;
const mark = n => n.score?.grade ? badge(n.score.grade) : '';
const mvHtml = (n, label) =>
  `<span class="mv${n === cur ? ' cur' : ''}" data-id="${n.id}">${label ? num(n.parent.ply) + ' ' : ''}${n.san}${mark(n)}</span>`;

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
// an engine line for white: its win chance, a value to sort by (a quicker mate is better) and its score as text
const chance = l => l.mate != null ? Math.sign(l.mate) : winning(l.cp);
const worth = l => l.mate != null ? Math.sign(l.mate) * 1e5 - l.mate : l.cp;
const fmt = l => {
  if (l.mate != null) return '#' + l.mate;
  const e = Math.round(l.cp / 10) / 10;
  return (e > 0 ? '+' : '') + e.toFixed(1);
};

function drawEval() {
  // a fight lost on time ends where it was lost
  const out = clock?.flag && mode === 'fight' && !cur.children.length && clock.flag;
  const end = game.isCheckmate() ? 'checkmate' : game.isStalemate() ? 'stalemate'
    : game.isInsufficientMaterial() ? 'insufficient material' : game.isDraw() ? 'fifty moves' : out ? `${SIDE[out]} ran out of time` : '';
  // your move in a fight without hints: nothing runs, the last eval stays up
  const quiet = !end && blind() && game.turn() === side, best = pvs[0];
  // verity's first fight move waits on its model, the size is the model's 3.4 MB and the engine's 1.8 MB wasm
  const loading = engineMoves() && hunting() && !hunter?.warm, on = el.on.checked || engineMoves();
  const big = on && !loaded.has(`/chess/engines/${el.engine.value}/`) && BIG[el.engine.value];
  let white = null, score = '', info = quiet ? 'your move' : loading ? 'loading its model, ~5 MB the first time'
    : big || (on ? 'thinking' : 'engine off');
  if (end) {
    white = end === 'checkmate' ? +(game.turn() === 'b') : out ? +(out === 'b') : .5;  // white's share of the gauge
    score = ['0-1', '½-½', '1-0'][white * 2];
    info = end;
  } else if (best) {
    white = (1 + chance(best)) / 2;
    score = fmt(best);
    info = `depth ${best.depth}` + (best.sel ? '/' + best.sel : '') + (best.nps ? ` · ${Math.round(best.nps / 1000).toLocaleString()} kn/s` : '');
  }
  if (!quiet) el.score.textContent = score;
  el.info.textContent = info;
  if (white !== null) el.gaugeW.style.height = white * 100 + '%';
  // a row per line, empty ones hold the space while the engine starts. the moves in san, each clickable
  el.pv.innerHTML = Array.from({ length: end ? 0 : want() }, (_, l) => {
    const g = new Chess(cur.fen), p = !blind() && pvs[l];
    return '<div>' + (p ? `<b>${fmt(p)}</b>` + p.pv.map((u, i) => {
      const ply = cur.ply + i, m = g.move(uciMove(u));
      return `<span data-l="${l}" data-i="${i}" data-fen="${g.fen()}">${!i || ply % 2 === 0 ? num(ply) + ' ' : ''}${m.san}</span>`;
    }).join('') : '') + '</div>';
  }).join('');
  el.pvMore.hidden = !el.pv.classList.contains('open') && [...el.pv.children].every(d => d.scrollWidth <= d.clientWidth);
  preview();
}

// hovering an engine line shows the position after the move under the pointer on a small board, like lichess. the
// pointer is kept so a pv update under a still mouse picks the right move again, and pieces slide between moves
let hoverAt = null, shown = null;
function preview() {
  const s = hoverAt ? document.elementFromPoint(...hoverAt)?.closest('#pv span') ?? null : null;
  if (s === shown) return;
  el.preview.classList.toggle('show', !!s);
  if (s) {
    const g = new Chess(s.dataset.fen), r = s.getBoundingClientRect(), t = el.tools.getBoundingClientRect();
    const w = el.preview.offsetWidth;
    el.preview.style.left = Math.min(Math.max(r.left + r.width / 2 - w / 2 - t.left, 8), t.width - w - 8) + 'px';
    el.preview.style.top = el.pvRow.getBoundingClientRect().bottom - t.top + 6 + 'px';
    syncPieces(!shown, el.pvPieces, g);
    el.pvSquares.innerHTML = marks(pvs[s.dataset.l].pv[s.dataset.i], g);
  }
  shown = s;
}

// engine folder -> its compiled chess.wasm, and the folders whose compile is done. the panel redraws once one is, so a
// slow first download's note (BIG) goes
const wasm = {}, loaded = new Set();
const compiled = dir => wasm[dir] ??= WebAssembly.compileStreaming(download(dir))
  .then(m => { loaded.add(dir); drawEval(); return m; });

// each engine's build, its folder's name -> a hash of its chess.wasm (config/site.js, on the engine picker)
const BUILD = Object.fromEntries(el.engine.dataset.wasm.split(' ').map(p => p.split(':')));
// an engine's wasm comes from the page's own cache storage when it holds this build, else from the server with a copy
// going in and any other build of that engine coming out. the browser's http cache won't keep one file that big (over
// 20 to 30 MB), so cynical's 43 MB came down again on every pick, and the small ones cost a round trip each visit to
// check. no cache storage (some private windows) or no room in it means the plain download, as before
async function download(dir) {
  const url = new URL(`${dir}chess.wasm?v=${BUILD[dir.split('/')[3]] ?? ''}`, location).href, path = new URL(url).pathname;
  let cache = null;
  try { cache = await caches.open('engines'); } catch {}
  const hit = await cache?.match(url).catch(() => null);
  if (hit) return hit;
  const res = await fetch(url);
  // only a whole wasm gets in: put waits for the body, so a dropped download leaves nothing
  if (cache && res.ok && res.headers.get('content-type') === 'application/wasm') cache.put(url, res.clone())
    .then(() => cache.keys()).then(keys => keys.forEach(k => k.url !== url && new URL(k.url).pathname === path && cache.delete(k)))
    .catch(() => {});
  return res;
}
// what the panel says while an engine too big to come in at once downloads: cynical's wasm carries its human net
const BIG = { cynical: 'loading its human net, ~40 MB the first time' };

// the options a visitor changed on an engine, name -> value. the rest stay at the engine's own defaults
const tuned = e => { try { return JSON.parse(localStorage['chess.opts.' + e] || '{}') || {}; } catch { return {}; } };
const retune = (e, t) => { try { localStorage['chess.opts.' + e] = JSON.stringify(t); } catch {} };

// the engines whose wasm needs its own glue (built with other imports), it sits next to their chess.wasm
const GLUE = ['suimate'];

// a worker running an engine, a folder under engines/ holding its chess.wasm (the worker and its glue are shared).
// the wasm is compiled once and handed over, a failed compile is dropped so the next worker tries again. every worker
// gets the changed options first, so analysis, fights and reviews all play with them
function spawn(engine = el.engine.value, set = tuned(engine)) {
  const dir = `/chess/engines/${engine}/`;
  const w = new Worker('/chess/engines/engine.worker.js' + V + (GLUE.includes(engine) ? `#${engine}/` : ''));
  compiled(dir).then(m => w.postMessage(m), () => { delete wasm[dir]; w.onerror(); });
  for (const [k, v] of Object.entries(set)) w.postMessage(`setoption name ${k} value ${v}`);
  return w;
}

// a fight against verity goes through engines/verity/verityb.worker.js (VerityB) instead: the same engine, but at each
// move its top 12 within 5 pawns of the best get a bonus from boosted trees (vbmodel.bin), a guess from the board at
// how many moves sooner each one mates a ~1400, and the best total is played. no human model runs at play time. its go
// takes no limits (node counted, under a second a move), so the strength picker steps aside. analysis and reviews stay
// on the plain engine. one worker lasts the whole fight: its isready loads the trees while you think and the engine
// keeps its hash, so unlike the others it isn't killed on every move. a move can't be cut short either, so the answers
// come back in the order they were asked and one for a position you've since left is dropped. asked holds, per command
// still running, the node of a go or null for the isready
let hunter = null, asked = [];
const hunting = () => mode === 'fight' && el.engine.value === 'verity';

function hunt() {
  if (hunter) return;
  const dir = '/chess/engines/verity/', w = hunter = new Worker(dir + 'verityb.worker.js' + V);
  // the page's compiled wasm goes first, before any command, or the worker fetches its own (as it does if that failed)
  const up = compiled(dir).then(m => w.postMessage(m), () => { delete wasm[dir]; });
  w.send = c => up.then(() => w.postMessage(c));
  for (const [k, v] of Object.entries(tuned('verity'))) w.send(`setoption name ${k} value ${v}`);
  asked.push(null);
  w.send('isready');
  w.onmessage = e => {
    if (w !== hunter) return;
    const l = e.data, n = asked[0], best = BEST.exec(l), failed = l.startsWith('info string error');
    if (!best && !failed && l !== 'readyok') {
      const info = n && parse(l, n);
      if (info && n === cur) { pvs = [info]; drawEval(); drawShapes(); }
      return;
    }
    asked.shift();
    if (failed) return fail(l);
    w.warm = true;
    if (best && n === cur && engineMoves() && hunting()) goto(child(n, best[1]), true);
    else if (!best) drawEval();  // loaded, the note goes
  };
  w.onerror = () => fail('');
}

// a failed load (the model's download, most likely) drops the worker, the next move starts a fresh one
function fail(why) {
  if (why) console.warn('verity:', why);
  unhunt();
  el.info.textContent = 'Verity failed to load, try another move';
}
const unhunt = () => { hunter?.terminate(); hunter = null; asked = []; };
const ask = n => { hunt(); if (!asked.includes(n)) { asked.push(n); hunter.send(position(n)); hunter.send('go'); } };

// an engine's own options come from its reply to uci, so a new build's show up without touching the page. the page
// sets MultiPV itself (the lines picker) and Hash goes with the worker each move anyway, so those two stay out. a
// worker asks once per engine, with nothing set: the reply gives an option's current value as its default. avy: only
// spin options get a control, the engines have no other kind yet
const OPTION = /^option name (.+?) type spin default (-?\d+) min (-?\d+) max (-?\d+)/, OWN = ['Hash', 'MultiPV'];
const optionsOf = {};  // engine folder -> a promise of its options, [{ name, def, min, max }], null if it didn't load
function options(engine) {
  return optionsOf[engine] ??= new Promise(done => {
    const w = spawn(engine, {}), list = [];
    w.onmessage = e => {
      const m = OPTION.exec(e.data);
      if (m && !OWN.includes(m[1])) list.push({ name: m[1], def: +m[2], min: +m[3], max: +m[4] });
      if (e.data === 'uciok') { w.terminate(); done(list); }
    };
    w.onerror = () => { delete optionsOf[engine]; w.terminate(); done(null); };
    w.postMessage('uci');
  });
}

const clamp = (o, v) => Math.min(o.max, Math.max(o.min, Math.round(v)));
// the settings panel for the chosen engine, its button only shows when the engine has options. a saved value the
// engine doesn't take any more is dropped and the rest are clamped to its range, in case a new build changed them. an
// engine that didn't load says nothing about its options, so its saved ones stay for the next try
async function drawOpts() {
  const e = el.engine.value, list = await options(e);
  if (e !== el.engine.value) return;
  el.optBtn.hidden = !list?.length;
  if (!list?.length) return el.optBtn.ariaExpanded = false;
  const t = tuned(e), keep = {};
  for (const o of list) if (Number.isFinite(t[o.name]) && clamp(o, t[o.name]) !== o.def) keep[o.name] = clamp(o, t[o.name]);
  retune(e, keep);
  el.optName.textContent = el.engine.selectedOptions[0].text;
  el.optList.innerHTML = list.map(o => `<label title="default ${o.def}, ${o.min} to ${o.max}"${o.name in keep ? ' class="changed"' : ''}>${o.name}
    <input type="number" name="${o.name}" min="${o.min}" max="${o.max}" data-def="${o.def}" value="${keep[o.name] ?? o.def}"></label>`).join('');
  el.optReset.disabled = !Object.keys(keep).length;
}

const position = n => `position fen ${root.fen} moves ${path(n).join(' ')}`;
// an engine info line at node n in white's view: depth, seldepth (0 without), which line (1 without multipv), cp or
// mate, nps and the moves
const parse = (line, n) => {
  const m = INFO.exec(line);
  return m && { depth: +m[1], sel: +(m[2] ?? 0), k: +(m[3] ?? 1), [m[4]]: m[5] * (n.ply % 2 ? -1 : 1), nps: +m[6],
    pv: m[7].split(' ').filter(Boolean) };
};

// avy: the wasm build can't take a stop mid search, so a new position kills the worker and starts a fresh one and the
// hash goes with it. a pthreads build with stop would keep one worker. the wait lets arrow keys skim through moves
// without spinning one up for each
function analyse() {
  clearTimeout(timer);
  worker?.terminate();
  worker = null;
  pvs = [];
  el.deeper.hidden = true;
  if (hunting()) hunt(); else unhunt();
  drawEval();
  drawShapes();
  const plays = engineMoves();
  if (edit || game.isGameOver() || !plays && (!el.on.checked || blind() && game.turn() === side)) return;
  timer = setTimeout(function start(tries = 0) {
    if (plays && hunting()) return ask(cur);
    const n = cur, w = worker = spawn(), lines = want(), side = n.ply % 2 ? -1 : 1;
    let got = [];
    w.onmessage = e => {
      if (w !== worker) return;
      // it searches the start position instead, so its lines wouldn't fit this one
      if (e.data.startsWith('info string invalid fen')) { worker = null; w.terminate(); el.info.textContent = 'the engine refused this position'; return; }
      // a bestmove in analysis means its 30s ran out, the + then lets it search on (el.deeper)
      const info = parse(e.data, n), best = BEST.exec(e.data);
      if (best) return plays ? goto(child(n, best[1]), true) : (el.deeper.hidden = false);
      if (!info || !el.on.checked) return;
      // the lines of a depth come one by one from line 1 and show once they're all in, so depths don't mix. they're in
      // search order, a later one can score a little higher, so they get sorted
      if (info.k === 1) got = [];
      got[info.k - 1] = info;
      if (info.k < lines) return;
      pvs = got.sort((a, b) => side * (worth(b) - worth(a)));
      drawEval();
      drawShapes();
    };
    // a failed load (a dropped download of the wasm, cynical's 43 MB on a phone, or too little memory) starts again on
    // the same position, twice, a little later each time. leaving the position clears the timer and the retry with it
    w.onerror = () => {
      if (w !== worker) return;
      worker = null;
      w.terminate();
      if (tries < 2) timer = setTimeout(start, 2000 * (tries + 1), tries + 1);
      el.info.textContent = tries < 2 ? 'engine failed to load, trying again' : 'engine failed to load, try another move';
    };
    w.postMessage(`setoption name MultiPV value ${lines}`);
    w.postMessage(position(n));
    // a fight move searches as the strength picker says (its values are go args) and within its clock, analysis is
    // capped so an idle tab doesn't spin the fan forever
    w.postMessage(`go ${plays ? limits() : 'movetime 30000'}`);
  }, 150);
}

// the + after analysis stopped: the same worker searches the position again with no limit, its hash gets it back to
// the depth it had in a moment. it runs until you leave the position, the next one is capped again
el.deeper.onclick = () => { el.deeper.hidden = true; worker?.postMessage('go infinite'); };

const reviewing = () => el.reviewBtn.ariaPressed === 'true';
const depth = () => DEPTH[el.engine.value] ?? 12;
const lead = fen => [...fen.split(' ')[0]].reduce((s, c) => s + (VALUE[c.toLowerCase()] ?? 0) * (c < 'a' ? 1 : -1), 0);  // white's material lead
const accuracy = loss => Math.min(100, Math.max(0, 103.1668 * Math.exp(-0.04354 * loss * 50) - 3.1669));  // lichess's, per move

// review: one worker scores the main line position by position. a search to a fixed depth ends by itself, so unlike
// live analysis the worker lives through the whole game and keeps its hash. the next position is always the first
// unscored one, so moves added meanwhile get picked up. a score is white's win chance (-1..1), the engine's cp or mate
// in white's view (null when it gave none), the best move and the line. once every position is scored, a second pass:
// the ones whose next move could be great (wantsAlt) are searched again for two lines, alt is their win chances (null
// when it wasn't needed or there's one legal move), and a brilliant move's sacrifice is taken to find the answer that
// makes it work, refute (its line, [] if there's none). a second pass because two lines split the search, and those
// searches in the same hash, made the scores wobble. it starts once the opening book is in
function review() {
  if (reviewer) return;
  if (!book) return void loadBook().then(() => reviewing() && review());
  const w = reviewer = spawn(), d = depth();
  let n, lines, kind, multi = 1;
  const next = () => {
    const line = walk(root);
    kind = (n = line.find(n => !n.score)) ? 'score' : (n = line.find(wantsAlt)) ? 'alt'
      : (n = line.find(n => n.score.grade === 'brilliant' && n.score.refute === undefined)) ? 'refute' : '';
    if (!n) { w.terminate(); reviewer = null; return drawReview(); }
    const g = new Chess(n.fen);
    if (kind === 'score' && g.isGameOver()) return scored(n, { win: g.isCheckmate() ? (g.turn() === 'w' ? -1 : 1) : 0, cp: null, mate: null, pv: [], alt: null }), next();
    const k = kind === 'alt' ? 2 : 1;
    if (k !== multi) w.postMessage(`setoption name MultiPV value ${multi = k}`);
    lines = [];
    w.postMessage(kind === 'refute' ? `position fen ${root.fen} moves ${[...path(n), n.score.sac.uci].join(' ')}` : position(n));
    w.postMessage(`go depth ${d}`);
  };
  w.onmessage = e => {
    if (w !== reviewer) return;
    // the sacrifice taken is a ply past n
    const at = kind === 'refute' ? { ply: n.ply + 1 } : n, info = parse(e.data, at), best = BEST.exec(e.data);
    if (info) lines[info.k - 1] = info;
    if (!best) return;
    // the last depth's lines, best first (they come in search order, a later one can score a little higher)
    const side = at.ply % 2 ? -1 : 1, [top, alt] = lines.filter(Boolean).sort((a, b) => side * (worth(b) - worth(a)));
    if (kind === 'alt') {
      n.score.alt = top && alt ? { top: chance(top), next: chance(alt) } : null;
      upgrade(n.children[0]);
    } else if (kind === 'refute') {
      n.score.refute = top?.pv ?? [];
      delete n.score.note;
      drawReview();
    } else scored(n, { win: top ? chance(top) : n.parent?.score.win ?? 0, cp: top?.cp ?? null, mate: top?.mate ?? null, best: best[1], pv: top?.pv ?? [] });
    next();
  };
  w.onerror = () => { reviewer = null; el.stats.textContent = 'engine failed to load, press review again'; };
  next();
}

// a scored position needs its two lines when the main line goes on with the engine's move, played from a level or
// better game and not obvious (grade). decided once, the move after the last one waits until it's played
function wantsAlt(n) {
  const c = n.children[0];
  if (n.score.alt !== undefined || !c) return false;
  if (c.uci === n.score.best && (n.ply % 2 ? -1 : 1) * n.score.win >= -.15 && !obvious(c)) return true;
  n.score.alt = null;
  return false;
}

// a move graded nothing that turns out great once its position's two lines are in
function upgrade(n) {
  if (!n?.score || n.score.grade || n.score.book || !great(n)) return;
  n.score.grade = 'great';
  delete n.score.note;
  el.moves.querySelector(`[data-id="${n.id}"]`)?.insertAdjacentHTML('beforeend', mark(n));
  drawReview();
}

function scored(n, s) {
  n.score = s;
  if (n.parent) grade(n);
  el.moves.querySelector(`[data-id="${n.id}"]`)?.insertAdjacentHTML('beforeend', mark(n));
  drawReview();
}

// the opening book: the named positions of lichess's chess-openings (CC0, github.com/lichess-org/chess-openings), as
// "<the first four fen fields>\t<eco> <name>" in openings.tsv. fetched when a review first starts, empty if that fails
let book = null, booking = null;
const loadBook = () => booking ??= fetch('/chess/openings.tsv' + V).then(r => r.ok ? r.text() : '').catch(() => '')
  .then(t => { book = new Map(t.split('\n').filter(Boolean).map(l => l.split('\t'))); });
const named = n => book.get(n.fen.split(' ', 4).join(' '));
// a book move's opening, '' if it isn't one: it follows book moves from the start position and lands on a named
// position, or on one between two (a named one comes within the next 6 plies of the main line), which keeps the last name
function bookOf(n) {
  const prev = n.parent.parent ? n.parent.score.book : n.parent.fen === START ? '' : null;
  if (prev == null || n.parent.parent && !prev) return '';
  if (named(n)) return named(n);
  const ahead = walk(n).slice(1, 7).find(named);
  return ahead ? prev || named(ahead) : '';
}

const stopReview = () => { reviewer?.terminate(); reviewer = null; };
// scores belong to one engine and one tree
function resetReview() {
  stopReview();
  for (const n of nodes ?? []) delete n.score;
}

// lichess's grades on the win chance the mover gave away. brilliant is our take on chess.com's: a sacrifice (sacrifice)
// that is the engine's move or close to it, by a mover who isn't worse after it and wasn't already a rook up (no
// sacrifice needed then). close is within .04 of the win chance, and in a won position, where the win chance hardly
// moves, also keeping three quarters of the score. a mate the mover had has to be kept, so only the engine's move counts
// book moves get no grade, like chess.com, and stay out of the accuracy.
// missed win, chess.com's miss: the other side's last move was a mistake or blunder that left the mover clearly better,
// and this move gives a mistake's worth or more of it back, but no further than where the game stood before it.
// great comes later, from the second pass (great, upgrade)
function grade(n) {
  const S = n.score, P = n.parent.score, G = n.parent.parent?.score, s = n.parent.ply % 2 ? -1 : 1;
  const before = s * P.win, after = s * S.win, loss = S.loss = Math.max(0, before - after);
  if ((S.book = bookOf(n))) return;
  if (loss >= .2 && /mistake|blunder/.test(P.grade) && before >= .3 && G && after >= s * G.win - .15) return S.grade = 'miss';
  if (loss >= .1) return S.grade = loss >= .3 ? 'blunder' : loss >= .2 ? 'mistake' : 'inaccuracy';
  const mating = Math.sign(P.mate ?? 0) === s, cpLoss = P.cp != null && S.cp != null ? s * (P.cp - S.cp) : 0;
  const close = n.uci === P.best || !mating && loss <= .04 && cpLoss <= Math.max(50, Math.abs(P.cp ?? 0) / 4);
  if (close && after > -.2 && s * lead(n.parent.fen) < 5 && (S.sac = sacrifice(n))) S.grade = 'brilliant';
}

// great, chess.com's: the engine's move, when the next best gives up a mistake's worth or more and isn't winning, both
// from the position's two line search, from a game the mover is level in or better. an only move that's plain to see
// doesn't count (obvious)
function great(n) {
  const P = n.parent.score, A = P.alt, s = n.parent.ply % 2 ? -1 : 1;
  return !!A && n.uci === P.best && s * (A.top - A.next) >= .2 && s * A.next <= .5 && s * P.win >= -.15 && !obvious(n);
}

// an only move anyone would find: a way out of check, a mate, taking back on the square the other side just took on,
// a capture that wins material outright (a free pawn too), moving a piece that was hanging out of the way, or quietly
// meeting every threat there was (the other side could win something if the mover passed, and can't after it). a check
// stops every capture for a move, so it isn't meeting threats
function obvious(n) {
  const g = new Chess(n.parent.fen), to = n.uci.slice(2, 4);
  if (g.inCheck()) return true;
  const m = g.move(uciMove(n.uci));
  if (g.isCheckmate()) return true;
  if (n.parent.parent && n.parent.uci.slice(2, 4) === to && new Chess(n.parent.parent.fen).get(to)) return true;
  if (m.captured && took(m) - see(g, to) > 0) return true;
  const pass = flip(n.parent.fen, other(m.color));
  return pass && see(pass, m.from) >= 2 || !!meets(n.parent.fen, g, m);
}

// a sacrifice: after the move the other side can win one of the mover's pieces by taking it (offers), and the mover
// didn't have to allow that. a fork or a trapped piece loses something whatever is played, so it has to give up more
// than the least it could have (forced). it's the piece and the capture that takes it, or null. the engine's own line
// isn't used, a sound sacrifice is usually best declined. the capture is kept as san (by) and uci (for the search of
// what answers it, review)
function sacrifice(n) {
  const g = new Chess(n.parent.fen), [top] = offers(g, g.move(uciMove(n.uci)));
  if (!top || top.net <= forced(n.parent.fen)) return null;
  const cap = g.moves({ verbose: true }).filter(m => m.to === top.sq && m.captured).sort((a, b) => cost(a.piece) - cost(b.piece))[0];
  return { ...top, by: cap.san, uci: cap.lan };
}

// the mover's pieces (no king or pawn) that the side to move in g can now win by capturing them, after the mover's move
// m: two points or more and more than m itself took, so trades don't count. the most it nets first
function offers(g, m) {
  const t = took(m), list = [];
  for (const p of g.board().flat()) {
    if (!p || p.color !== m.color || !(VALUE[p.type] > 1) || !g.isAttacked(p.square, g.turn())) continue;
    const gain = see(g, p.square);
    if (gain >= 2 && gain > t) list.push({ piece: p.type, sq: p.square, net: gain - t });
  }
  return list.sort((a, b) => b.net - a.net);
}
// what a move takes, a promotion counted as what it gains
const took = m => (VALUE[m.captured] ?? 0) + (m.promotion ? VALUE[m.promotion] - 1 : 0);

// the least the side to move in fen has to leave up for grabs, over all its moves (0 when one keeps everything)
function forced(fen) {
  const g = new Chess(fen);
  let least = Infinity;
  for (const m of g._moves()) {
    g._makeMove(m);
    least = Math.min(least, offers(g, m)[0]?.net ?? 0);
    g._undoMove();
    if (!least) break;
  }
  return least;
}

// static exchange: what the side to move wins by capturing on sq, both sides taking back with their cheapest piece and
// either free to stop. legal moves only, so a pinned piece can't take and a king can't take a guarded piece. avy:
// chess.js's private move list (_moves, _makeMove, _undoMove), its public moves() makes the san and fens of every move
// and is ~40x slower here
const cost = t => VALUE[t] ?? 99, x88 = sq => (8 - sq[1]) * 16 + FILES.indexOf(sq[0]);
function see(g, sq, at = x88(sq)) {
  const m = g._moves().filter(m => m.to === at && m.captured && (m.promotion ?? 'q') === 'q').sort((a, b) => cost(a.piece) - cost(b.piece))[0];
  if (!m) return 0;
  g._makeMove(m);
  const v = VALUE[m.captured] + (m.promotion ? VALUE.q - 1 : 0) - see(g, sq, at);
  g._undoMove();
  return Math.max(0, v);
}

// a score as text, '' for a finished game
const said = sc => sc.mate != null || sc.cp != null ? fmt(sc) : '';

// a uci line from fen at ply p as san, numbered like the engine lines, up to a move that doesn't fit
function sanLine(fen, p, uci) {
  const g = new Chess(fen), out = [];
  for (const [i, u] of uci.entries()) {
    try { out.push((!i || (p + i) % 2 === 0 ? num(p + i) + ' ' : '') + g.move(uciMove(u)).san); } catch { break; }
  }
  return out;
}

// the material side c gains over a line from fen: its first four moves, then on while they capture so an exchange isn't
// cut in half. the points, the pieces each side took, and k the moves it takes to get there: from then on the count
// never falls short of its end, for whichever side comes out ahead
function swing(fen, uci, c) {
  const g = new Chess(fen), got = [], lost = [], nets = [0];
  for (const u of uci.slice(0, 10)) {
    let m;
    try { m = g.move(uciMove(u)); } catch { break; }
    if (nets.length > 4 && !m.captured) break;
    if (m.captured) (m.color === c ? got : lost).push(m.captured);
    nets.push(nets.at(-1) + (m.captured ? VALUE[m.captured] * (m.color === c ? 1 : -1) : 0));
  }
  const net = nets.at(-1), s = Math.sign(net) || 1;
  let k = nets.length - 1;
  while (k > 0 && s * nets[k - 1] >= s * net) k--;
  return { net, got, lost, k };
}

// material won in words, from the pieces taken each way: what's left once both sides' takes of the same kind cancel (a
// knight and a bishop count as one kind). one piece is named, one for one is "the queen for a piece" (a rook for a
// minor piece is the exchange), pawns are counted, else it's the points' plain name or just material
function amount(net, got = [], lost = []) {
  const kind = t => t === 'b' ? 'n' : t, g = got.map(kind), l = [];
  for (const t of lost.map(kind)) {
    const i = g.indexOf(t);
    if (i < 0) l.push(t); else g.splice(i, 1);
  }
  const one = t => ({ p: 'a pawn', n: 'a piece', r: 'a rook', q: 'the queen' })[t];
  if (g.length === 1 && l.length <= 1) return !l.length ? one(g[0]) : g[0] === 'r' && l[0] === 'n' ? 'the exchange' : `${one(g[0])} for ${one(l[0])}`;
  if (g.length > 1 && !l.length && g.every(t => t === 'p')) return `${['two', 'three', 'four'][g.length - 2] ?? g.length} pawns`;
  return { 1: 'a pawn', 3: 'a piece', 4: 'a piece and a pawn' }[net] ?? 'material';
}

// tactics a move makes, each checked on the board after it (a) against the one before (b). the opposing pieces the
// moved piece hits that are worth more than it or undefended, two or more is a fork
function fork(a, m) {
  const c = m.color, v = cost(m.promotion ?? m.piece);
  const hit = a.board().flat().filter(p => p && p.color !== c && a.attackers(p.square, c).includes(m.to)
    && (cost(p.type) > v || VALUE[p.type] > 1 && !a.attackers(p.square, other(c)).length));
  return hit.length > 1 ? hit.sort((x, y) => cost(y.type) - cost(x.type)) : null;
}
// another piece of the mover's newly hitting the king, queen or a rook, the moved one stepped out of its way. castling
// moves the rook too, so it doesn't count
function discovered(b, a, m) {
  if (/[kq]/.test(m.flags)) return null;
  const c = m.color, big = a.board().flat().filter(p => p && p.color !== c && 'kqr'.includes(p.type)).sort((x, y) => cost(y.type) - cost(x.type));
  for (const p of big) {
    const was = b.attackers(p.square, c), now = a.attackers(p.square, c).filter(s => s !== m.to && !was.includes(s));
    if (now.length) return { target: p, by: a.get(now[0]).type, double: a.attackers(p.square, c).includes(m.to) };
  }
  return null;
}
// a bishop, rook or queen move lining up two opposing pieces: a pin when the one behind is worth more (or is the king),
// a skewer when the front one is the king or queen and the one behind a piece that's worth winning, undefended or worth
// more than the piece skewering it
const RAYS = { b: [[1, 1], [1, -1], [-1, 1], [-1, -1]], r: [[1, 0], [-1, 0], [0, 1], [0, -1]] };
function pin(a, m) {
  const t = m.promotion ?? m.piece, dirs = t === 'q' ? [...RAYS.b, ...RAYS.r] : RAYS[t];
  for (const [df, dr] of dirs ?? []) {
    let front = null;
    for (let x = FILES.indexOf(m.to[0]) + df, y = +m.to[1] + dr; x >= 0 && x < 8 && y >= 1 && y <= 8; x += df, y += dr) {
      const sq = FILES[x] + y, p = a.get(sq);
      if (!p) continue;
      if (p.color === m.color) break;
      if (!front) { front = { ...p, square: sq }; continue; }
      if (!'kp'.includes(front.type) && cost(p.type) > cost(front.type)) return { pin: true, front, back: { ...p, square: sq } };
      if ('kq'.includes(front.type) && cost(front.type) > cost(p.type) && VALUE[p.type] >= 3
        && (VALUE[p.type] > VALUE[t] || !a.attackers(sq, p.color).length)) return { pin: false, front, back: { ...p, square: sq } };
      break;
    }
  }
  return null;
}
// an opposing piece (a knight or more) the move leaves attacked and winnable, whose every move lands where the mover
// can still win it, and that wasn't up for grabs before the move: trapped. defending it instead isn't looked at
function trapped(b, a, m) {
  const pass = !a.inCheck() && flip(a.fen(), m.color);
  if (!pass) return null;
  for (const p of a.board().flat()) {
    if (!p || p.color === m.color || !(VALUE[p.type] >= 3) || see(pass, p.square) < 2 || see(b, p.square) >= 2) continue;
    const at = x88(p.square);
    if (a._moves().filter(x => x.from === at).every(x => {
      a._makeMove(x);
      const lost = see(a, alg(x.to)) >= 2;
      a._undoMove();
      return lost;
    })) return p;
  }
  return null;
}

// fen as if the side to move passed and c moved instead (a null move), null when that can't be: the side to move is in
// check, so passing would leave its king to be taken
const alg = i => FILES[i & 7] + (8 - (i >> 4));
function flip(fen, c) {
  const f = fen.split(' ');
  if (f[1] !== c && new Chess(fen).inCheck()) return null;
  f[1] = c;
  f[3] = '-';
  try { return new Chess(f.join(' ')); } catch { return null; }
}
// a mate in one for the side to move in h, as san, or null
function mateIn1(h) {
  for (const x of h?._moves() ?? []) {
    h._makeMove(x);
    const mate = h.inCheck() && !h._moves().length;
    h._undoMove();
    if (mate) return new Chess(h.fen()).move({ from: alg(x.from), to: alg(x.to), promotion: x.promotion }).san;
  }
  return null;
}
// what side c threatens in a if it could move again: a mate in one, or pieces worth two points or more it can win that
// it couldn't in b. none after a check, that's its own threat
function threats(b, a, c) {
  const t = !a.inCheck() && flip(a.fen(), c);
  if (!t) return {};
  const mate = mateIn1(t);
  return mate ? { mate } : { hit: t.board().flat().filter(p => p && p.color !== c && p.type !== 'k' && t.isAttacked(p.square, c)
    && see(t, p.square) >= 2 && !(b.get(p.square)?.type === p.type && see(b, p.square) >= 2)) };
}
// the threat a quiet move meets: the other side could win something if the mover passed and can't after the move. the
// piece that stood to lose the most, or null
function meets(fen, a, m) {
  const pass = !a.inCheck() && flip(fen, other(m.color));
  if (!pass) return null;
  const mine = h => h.board().flat().filter(p => p && p.color === m.color && p.type !== 'k').map(p => ({ ...p, gain: see(h, p.square) }));
  const was = mine(pass).filter(p => p.gain > 0).sort((x, y) => y.gain - x.gain);
  return was.length && !mine(a).some(p => p.gain > 0) ? was[0] : null;
}
// an in-between move: the line's third move takes something the mover could already have taken, this move came first
function between(b, m, line) {
  const t = line[2]?.slice(2, 4);
  return !!t && t !== m.to && b.moves({ verbose: true }).some(x => x.to === t && x.captured);
}

// what a move does, a phrase after "it", the strongest that fits: mate, a fork, a discovered attack, a pin or skewer, a
// trapped piece, a capture that takes back or wins material, material its line wins within three moves (later it's the
// line's doing, not the move's), a mate threat it stops, one it makes, a threat it meets, pieces it attacks, check,
// promotion, castling, a trade (ahead of the attacks when it's an even one, what a trade then hits is beside the
// point), else ''. line is the move and the engine's line after it, p the ply it's played at, prev the move before it
// (taking the piece that just took on that square is taking back, unless it's worth far more than what it took)
const the = p => p.type === 'k' ? 'the king' : `the ${NAMES[p.type]} on ${p.square}`;
const before = n => n.parent?.parent ? new Chess(n.parent.parent.fen).move(uciMove(n.parent.uci)) : null;
function what(fen, uci, p, line = [uci], prev = null) {
  const b = new Chess(fen), a = new Chess(fen), m = a.move(uciMove(uci)), check = a.inCheck(), tail = check ? ' with check' : '';
  if (a.isCheckmate()) return 'mates';
  const f = fork(a, m);
  if (f) return `forks ${f.map(the).join(' and ')}`;
  const d = discovered(b, a, m);
  if (d) return d.target.type !== 'k' ? `uncovers an attack on the ${NAMES[d.target.type]}${tail}`
    : d.double ? 'gives double check' : `uncovers check from the ${NAMES[d.by]}`;
  const l = pin(a, m);
  if (l) return l.pin ? `pins ${the(l.front)} to the ${NAMES[l.back.type]}${tail}` : `skewers the ${NAMES[l.front.type]} and ${the(l.back)}`;
  const tr = trapped(b, a, m);
  if (tr) return `traps ${the(tr)}`;
  if (m.captured && prev?.captured && prev.to === m.to && VALUE[m.captured] <= VALUE[prev.captured] + 2) return `takes the ${NAMES[m.captured]} back${tail}`;
  const back = m.captured ? see(a, m.to) : 0, net = m.captured ? took(m) - back : 0;
  if (net > 0) return `wins ${!back && m.captured !== 'p' ? `the ${NAMES[m.captured]}` : amount(net, [m.captured], back ? [m.piece] : [])}${tail}`;
  const trade = !m.captured ? '' : m.piece === m.captured ? `trades ${NAMES[m.piece]}s` : `trades the ${NAMES[m.piece]} for the ${NAMES[m.captured]}`;
  const w = line.length > 1 && swing(fen, line, m.color);
  if (w && w.net >= 2 && w.k <= 3) return `wins ${amount(w.net, w.got, w.lost)}${w.k === 3 && between(b, m, line) ? ' with an in-between move' : ''}, `
    + sanLine(fen, p, line.slice(0, w.k)).join(' ');
  const danger = mateIn1(flip(fen, other(m.color)));
  if (danger && !mateIn1(a)) return `stops ${danger}`;
  const t = threats(b, a, m.color);
  if (t.mate) return `threatens ${t.mate}`;
  if (trade && !net && back) return trade;
  const safe = meets(fen, a, m);
  if (safe) return safe.square === m.from ? `saves the ${NAMES[safe.type]}` : `defends ${the(safe)}`;
  if (t.hit?.length) return `attacks ${t.hit.sort((x, y) => cost(y.type) - cost(x.type)).map(the).join(' and ')}`;
  if (check) return 'gives check';
  if (m.promotion) return `promotes to a ${NAMES[m.promotion]}`;
  if (/[kq]/.test(m.flags)) return 'castles';
  return trade;
}
// a phrase that explains something, not just a check, castling or a trade
const telling = d => /^(mates|forks|uncovers|gives double|pins|skewers|traps|wins|stops|threatens|saves|defends|attacks)/.test(d);

// a move's note: what it is, what it does and why, and the engine's line from before it when it played something else
function note(n) {
  const S = n.score, P = n.parent.score, me = n.parent.ply % 2 ? 'b' : 'w', s = me === 'w' ? 1 : -1, x = s * S.win, p = n.parent.ply;
  const best = P.best && new Chess(n.parent.fen).move(uciMove(P.best)).san, bestLine = P.pv[0] === P.best ? P.pv : [P.best];
  const line = !best || n.uci === P.best ? null : bestLine.slice(0, 10);
  if (new Chess(n.fen).isCheckmate()) return { text: `${n.san} is checkmate` };
  if (S.book) return { text: `${n.san} is a book move, ${S.book.slice(S.book.indexOf(' ') + 1)}` };
  const prev = before(n), does = what(n.parent.fen, n.uci, p, [n.uci, ...S.pv], prev);
  const bestDoes = line ? what(n.parent.fen, P.best, p, bestLine, prev) : '';
  // a brilliant move says what answers its sacrifice, once that's been searched (review), else how the game stands
  if (S.grade === 'brilliant') {
    const g = new Chess(n.fen), cap = g.move(uciMove(S.sac.uci)), R = S.refute ?? [];
    const answer = R.length ? what(g.fen(), R[0], n.ply + 1, R, cap) : '';
    return { text: `${n.san} is brilliant: ${S.sac.by} would win the ${NAMES[S.sac.piece]}, but ` + (telling(answer)
      ? `${new Chess(g.fen()).move(uciMove(R[0])).san} ${answer}`
      : Math.sign(S.mate ?? 0) === s ? 'it forces mate' : (x >= .15 ? `${SIDE[me]} is still ${x > .5 ? 'winning' : 'better'}` : `it's still about level`)
        + (telling(does) && !does.startsWith('wins') ? `, and it ${does}` : '')) };
  }
  if (S.grade === 'great') return { text: `${n.san} is a great move: ${does ? `it ${does}, and ` : ''}nothing else `
    + (s * P.win > .5 ? `keeps ${SIDE[me]} winning` : s * P.win >= .15 ? `keeps ${SIDE[me]} better` : 'holds the balance') };
  if (S.grade === 'miss') return { text: `${n.san} is a missed win: ${best}${telling(bestDoes) ? `, which ${bestDoes},` : ''} would have punished `
    + `${SIDE[other(me)]}'s ${P.grade}`, line };
  if (S.grade) return { text: `${n.san} is ${S.grade === 'inaccuracy' ? 'an' : 'a'} ${S.grade}: ${reason(n, me, best, bestDoes)}`, line };
  // ungraded: nothing much lost, also when the game was already decided either way
  if (n.uci === P.best) return { text: `${n.san} is the best move${does ? `, it ${does}` : ''}` };
  if (Math.sign(S.mate ?? 0) === -s) return { text: `${n.san} allows mate in ${Math.abs(S.mate)}, but ${SIDE[me]} was lost anyway`, line };
  if (Math.sign(P.mate ?? 0) === s && Math.sign(S.mate ?? 0) === s) return { text: `${n.san} still mates, ${best} was quicker`, line };
  return { text: `${n.san} is fine${telling(does) ? `, it ${does}` : ''}, but the engine preferred ${best}${telling(bestDoes) ? `, which ${bestDoes}` : ''}`, line };
}

// how a move turned the game, x and y the mover's win chance before and after
function turned(x, y, me) {
  const opp = SIDE[me === 'w' ? 'b' : 'w'], up = v => v > .5 ? 'win' : 'edge';
  if (y <= -.15) return x <= -.15 ? `it lets ${opp}'s lead grow` : x >= .15 ? `it turns the game, ${opp} is ${y < -.5 ? 'winning' : 'better'} now`
    : `it hands ${opp} ${y < -.5 ? 'a winning position' : 'the edge'}`;
  if (x < .15) return `it gives ${opp} a small edge`;
  return y >= .15 ? `it gives away some of ${SIDE[me]}'s lead` : `it throws away ${SIDE[me]}'s ${up(x)}`;
}

// why a graded move is bad, the first that fits: a mate it allows or misses, a draw it lets in, a piece it leaves
// hanging, the tactic the other side answers with (and its next one, two steps of a combination), material the other
// side's line wins, what the best move would have done, else how the game turned
function reason(n, me, best, bestDoes) {
  const S = n.score, P = n.parent.score, s = me === 'w' ? 1 : -1, end = new Chess(n.fen);
  const reply = S.pv[0] && new Chess(n.fen).move(uciMove(S.pv[0])).san;
  if (Math.sign(S.mate ?? 0) === -s) return Math.abs(S.mate) === 1 ? `it allows ${reply}` : `it allows mate in ${Math.abs(S.mate)}, starting with ${reply}`;
  if (Math.sign(P.mate ?? 0) === s && Math.sign(S.mate ?? 0) !== s) return `it misses mate in ${Math.abs(P.mate)} with ${best}`;
  if (end.isDraw()) return end.isStalemate() ? 'it stalemates' : 'it lets the game end in a draw';
  const g = new Chess(n.parent.fen), m = g.move(uciMove(n.uci)), [hung] = offers(g, m);
  if (hung) return `it leaves the ${NAMES[hung.piece]} on ${hung.sq} hanging`;
  const answer = reply ? what(n.fen, S.pv[0], n.ply, S.pv, m) : '';
  // the other side's move after that, in the position two plies on
  let then = '', thenSan = '';
  if (S.pv.length > 2) {
    const h = new Chess(n.fen);
    try {
      h.move(uciMove(S.pv[0]));
      const m2 = h.move(uciMove(S.pv[1]));
      thenSan = new Chess(h.fen()).move(uciMove(S.pv[2])).san;
      then = what(h.fen(), S.pv[2], n.ply + 2, S.pv.slice(2), m2);
    } catch { then = ''; }
  }
  // the second step only counts when it attacks, a retreat or a defence isn't part of the combination
  const verb = d => d.split(' ')[0], attacks = d => telling(d) && !/^(stops|saves|defends)/.test(d);
  if (telling(answer)) return `it allows ${reply}, which ${answer}` + (attacks(then) && verb(then) !== verb(answer) ? `, then ${thenSan} ${then}` : '');
  const w = swing(n.parent.fen, [n.uci, ...S.pv], me);
  if (w.net <= -2) return `${SIDE[other(me)]} wins ${amount(-w.net, w.lost, w.got)} with ${sanLine(n.fen, n.ply, S.pv.slice(0, w.k - 1)).join(' ')}`;
  if (telling(bestDoes)) return `it misses ${best}, which ${bestDoes}`;
  if (attacks(then)) return `it allows ${reply} and then ${thenSan}, which ${then}`;
  return turned(s * P.win, s * S.win, me);
}

// the eval graph (white's win chance, lichess style: white's area under the line) with the grades as ticks and where
// you are, then per side accuracy (avy: a plain mean of lichess's per move accuracy, lichess weights it by volatility)
// and grade counts. the stats are a live region kept busy while the review runs, so a screen reader hears the result once
function drawReview() {
  drawTag();
  if (!reviewing()) return;
  const line = walk(root);
  el.stats.ariaBusy = !!reviewer;
  if (line.length < 2) {
    el.graph.replaceChildren();
    el.note.replaceChildren();
    el.stats.innerHTML = '<p>play or import a game to review it</p>';
    return;
  }
  const done = line.filter(n => n.score), pts = done.map((n, i) => `${i},${1 - n.score.win}`), here = line.indexOf(cur);
  el.graph.setAttribute('viewBox', `0 0 ${Math.max(line.length - 1, 1)} 2`);
  el.graph.innerHTML = `<line class="mid" x1="0" x2="${line.length}" y1="1" y2="1"/>`
    + (pts.length ? `<path class="area" d="M0,2L${pts.join('L')}L${pts.length - 1},2Z"/><path class="curve" d="M${pts.join('L')}"/>` : '')
    + done.map((n, i) => n.score.grade ? `<line class="${n.score.grade}" x1="${i}" x2="${i}" y1="0" y2=".45"/>` : '').join('')
    + (here < 0 ? '' : `<line class="here" x1="${here}" x2="${here}" y1="0" y2="2"/>`);
  // the opening is the last book move's, its eco code first
  const open = done.findLast(n => n.score.book)?.score.book;
  // a table: the grades' badges on top, then each side's accuracy and how many of each
  el.stats.innerHTML = (open ? `<p class="open"><b>${open.replace(' ', '</b>')}</p>` : '') + '<i></i><i></i>' + Object.keys(GRADES).map(badge).join('')
    + ['white', 'black'].map((name, p) => {
      const moves = done.filter(n => n.parent && n.parent.ply % 2 === p && !n.score.book);
      const acc = moves.length ? Math.round(moves.reduce((s, n) => s + accuracy(n.score.loss), 0) / moves.length) + '%' : '–';
      return `<b>${name}</b><span>${acc}</span>` + Object.keys(GRADES).map(g => {
        const k = moves.filter(n => n.score.grade === g).length;
        return `<span class="n${k ? '' : ' none'}" title="${name}'s ${GRADES[g][1].replace(/y$/, 'ie')}s">${k}</span>`;
      }).join('');
    }).join('') + (!reviewer ? '' : `<p>reviewing at depth ${depth()}, `
      + (done.length < line.length ? `${done.length} of ${line.length} positions</p>` : 'a second look at the key moves</p>'));
  drawNote(here);
}

// the note on the move you're on: what it is and why, the engine's score before and after, and its line from before
// the move when it wanted another (a click on one of its moves goes there, like the engine lines). noteLine is that
// line and where it starts
let noteLine = null;
function drawNote(here) {
  const n = cur, N = here > 0 && n.score && (n.score.note ??= note(n));
  noteLine = N?.line ? { from: n.parent, uci: N.line } : null;
  if (here < 0) return el.note.innerHTML = `<p class="quiet">side lines aren't reviewed, only the main line</p>`;
  if (!N) return el.note.replaceChildren();
  const ev = [n.parent.score, n.score].map(said);
  el.note.innerHTML = (ev.every(Boolean) ? `<span class="ev">${ev.join(' → ')}</span>` : '') + `<p>${mark(n)}${N.text}</p>`
    + (N.line ? `<p class="best"><b>best</b>${sanLine(n.parent.fen, n.parent.ply, N.line).map((s, i) => `<span data-i="${i}">${s}</span>`).join('')}</p>` : '');
}

// move sounds, chess.com's (sounds/, their names). stepping forward onto a move plays it: a check, else a promotion,
// castling or capture, else a plain move (in a fight the engine's moves sound like an opponent's), and the game end
// with it. stepping back plays the move taken back, without the game end. web audio, fetched on the first click or key
// since browsers only play sound after one. a missing file stays silent, a missing move-opponent plays move-self.
// setting a premove has its own (tryMove)
const SOUNDS = ['move-self', 'move-opponent', 'capture', 'castle', 'move-check', 'promote', 'game-end', 'premove'];
let audio = null;
const sounds = {};
function warm() {
  if (audio) return;
  try { audio = new AudioContext(); } catch { return; }
  for (const k of SOUNDS) sounds[k] = fetch(`/chess/sounds/${k}.mp3${V}`).then(r => r.ok ? r.arrayBuffer() : Promise.reject())
    .then(b => audio.decodeAudioData(b)).catch(() => null);
}
for (const t of ['pointerdown', 'keydown']) addEventListener(t, warm, { capture: true, once: true });
const play = k => sounds[k]?.then(b => {
  if (!b) return k === 'move-opponent' && play('move-self');
  const s = audio.createBufferSource();
  s.buffer = b;
  s.connect(audio.destination);
  s.start();
});
function sound(n, back) {
  const m = new Chess(n.parent.fen).move(uciMove(n.uci));
  play(/[+#]/.test(m.san) ? 'move-check' : m.promotion ? 'promote' : /[kq]/.test(m.flags) ? 'castle' : m.captured ? 'capture'
    : mode === 'fight' && m.color !== side ? 'move-opponent' : 'move-self');
  if (!back && new Chess(n.fen).isGameOver()) play('game-end');
}

// fight clocks (the fight bar's picker): minutes + seconds added a move. each side's time left in ms, the side whose
// clock runs (null until the fight's first move and once it's over) and since when, and the side that ran out (flag),
// which ends the fight. a clock only runs while the game is at the end of its line, stepping back through it pauses
// both. the engine's searches keep to its clock (limits)
let ticker = 0;
const running = () => !!clock?.on && !clock.flag && mode === 'fight' && !cur.children.length;
const left = c => clock[c] - (running() && clock.on === c ? performance.now() - clock.since : 0);
function resetClock() {
  const [m, i] = el.clock.value.split('+').map(Number);
  clock = mode === 'fight' && m ? { inc: i * 1000, w: m * 6e4, b: m * 6e4, on: null, since: 0, flag: null } : null;
  pres = [];
  tick();
}
// before a goto: the running clock is charged up to now. a move played (made, not stepped to) adds the mover's
// increment once the clocks have started and hands the clock to the other side, none when the game's over. the move
// is already in the tree by then (child), so the line counts as ended before it if that move is cur's only one
function clockMove(n, made) {
  if (!clock || clock.flag) return;
  const now = performance.now();
  if (clock.on && mode === 'fight' && cur.children.every(c => made && c === n)) clock[clock.on] -= now - clock.since;
  clock.since = now;
  if (!made) return;
  const mover = n.parent.ply % 2 ? 'b' : 'w';
  if (clock.on) clock[mover] += clock.inc;
  clock.on = new Chess(n.fen).isGameOver() ? null : other(mover);
}
// redraws the clocks, a tenth of a second at a time while one runs, and calls it when one runs out
function tick() {
  clearTimeout(ticker);
  drawClocks();
  if (!running()) return;
  if (left(clock.on) <= 0) return flag(clock.on);
  ticker = setTimeout(tick, 100);
}
function flag(c) {
  clock[c] = 0;
  clock.flag = c;
  pres = [];
  play('game-end');
  analyse();
  drawClocks();
  drawBoard();
}
// m:ss, and under ten seconds 0:09.8 like lichess
const hms = t => t >= 1e4 ? `${Math.floor(t / 6e4)}:${String(Math.floor(t / 1e3) % 60).padStart(2, '0')}`
  : `0:0${Math.floor(t / 1e3)}.${Math.floor(t / 100) % 10}`;
function drawClocks() {
  document.body.classList.toggle('clocked', !!clock);
  if (!clock) return;
  for (const [e, c] of [[el.myClock, side], [el.oppClock, other(side)]]) {
    const t = Math.max(0, left(c));
    e.lastChild.textContent = hms(t);
    e.firstChild.textContent = c === clock.flag ? 'out of time' : c === side ? 'you' : el.engine.selectedOptions[0].text;
    e.classList.toggle('on', running() && clock.on === c);
    e.classList.toggle('low', t < 1e4);
    e.classList.toggle('out', c === clock.flag);
  }
}
// the go args for an engine move: the strength picker's, and with a clock also a twenty-fifth of the engine's time plus
// most of the increment, never closer than a second to running out (half of what's left under two)
function limits() {
  const lv = el.level.value;
  if (!clock) return lv;
  const t = left(other(side)), b = Math.round(Math.max(50, Math.min(t / 25 + clock.inc * .8, t > 2e3 ? t - 1e3 : t / 2)));
  return lv.startsWith('movetime') ? `movetime ${Math.min(+lv.split(' ')[1], b)}` : `${lv} movetime ${b}`;
}

// made: a move played on the board or by the engine, rather than stepped to, it runs the clocks. the engine's move
// plays the first queued premove right after it when that's still legal, else the whole queue goes, like chess.com.
// your own moves keep the queue, stepping anywhere drops it
function goto(n, made = false) {
  if (n.parent && n.parent === cur) sound(n);
  else if (cur?.parent && cur.parent === n) sound(cur, true);
  if (mode === 'fight') clockMove(n, made);
  const engine = made && mode === 'fight' && (n.parent.ply % 2 ? 'b' : 'w') !== side;
  if (!made) pres = [];
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
  if (reviewing()) review();
  drawReview();
  tick();
  history.replaceState(null, '', n.fen === START ? location.pathname : '#' + n.fen.replaceAll(' ', '_'));
  if (engine && pres.length) {
    const [p, ...rest] = pres;
    const m = game.turn() === side && !n.children.length && !clock?.flag && game.moves({ square: p.from, verbose: true }).find(m => m.to === p.to);
    if (!m) { pres = []; drawBoard(); }
    else setTimeout(() => { if (cur === n) { pres = rest; goto(child(n, p.from + p.to + (m.promotion ? 'q' : '')), true); } });
  }
}

// fight and edit take over the panel, the same button again goes back to analysis. leaving edit keeps the position
// once it's legal, a changed one starts a fresh tree
function setMode(m) {
  if (edit) {
    const fen = editFen();
    if (fenError(fen)) return;
    if (fen.split(' ', 3).join() !== cur.fen.split(' ', 3).join()) { newRoot(fen); cur = root; }
    edit = null;
  }
  mode = mode === m ? '' : m;
  if (mode === 'fight') { side = flipped ? 'b' : 'w'; drawSide(); }
  resetClock();
  document.body.dataset.mode = mode;
  el.fightBtn.ariaPressed = mode === 'fight';
  el.editBtn.ariaPressed = mode === 'edit';
  for (const b of el.ctrl.querySelectorAll('.nav')) b.disabled = mode === 'edit';
  if (mode === 'edit') { editLoad(cur.fen); analyse(); }
  else goto(cur);
}
const cancelEdit = () => { if (edit) { edit = null; setMode('edit'); } };

// the board shows `edit`, the form holds the side to move and castling
function editLoad(fen) {
  edit = new Chess(fen, { skipValidation: true });
  const [, turn, castle] = edit.fen().split(' '), f = el.editor.elements;
  f.turn.value = turn;
  for (const c of f.castle) c.checked = castle.includes(c.value);
  editDraw();
}

const kindAt = sq => { const p = edit.get(sq); return p ? p.color + p.type : ''; };
const editFen = () => {
  const f = el.editor.elements, castle = [...f.castle].filter(c => c.checked && !c.disabled).map(c => c.value).join('');
  return `${edit.fen().split(' ')[0]} ${f.turn.value} ${castle || '-'} - 0 1`;
};

// why a fen can't be analysed, '' when it can. chess.js checks the kings and pawns, not that the side that just moved
// is out of check. the engine also refuses material a game can't reach, every piece past the starting set needs a
// pawn that promoted
function fenError(fen) {
  let f;
  try { f = new Chess(fen).fen().split(' '); } catch (e) { return e.message.replace('Invalid FEN: ', ''); }
  if (new Chess([f[0], f[1] === 'w' ? 'b' : 'w', f[2], '-', 0, 1].join(' ')).inCheck()) return 'the side not to move is in check';
  for (const c of 'wb') {
    const n = t => f[0].split(c === 'w' ? t.toUpperCase() : t).length - 1;
    const extra = Object.entries({ q: 1, r: 2, b: 2, n: 2 }).reduce((s, [t, k]) => s + Math.max(0, n(t) - k), 0);
    if (extra > 8 - n('p')) return `more ${c === 'w' ? 'white' : 'black'} pieces than its pawns could promote to`;
  }
  return '';
}

// a castling flag only counts while its king and rook are home
function editDraw() {
  for (const c of el.editor.elements.castle) {
    const [k, r] = CASTLE[c.value], side = c.value < 'a' ? 'w' : 'b';
    c.disabled = kindAt(k) !== side + 'k' || kindAt(r) !== side + 'r';
  }
  const fen = editFen(), err = fenError(fen);
  drawBoard();
  el.fen.value = fen;
  el.fen.classList.toggle('bad', !!err);
  el.editErr.textContent = err;
  el.done.disabled = !!err;
}

// on the board the hand drags pieces around and off it, a palette piece or the eraser paints every square the pointer
// crosses. right click erases, so does the chosen piece again on its own square
function editDown(e, sq) {
  if (!tool && e.button === 0) {
    if (edit.get(sq)) drag = { from: sq, el: el.pieces.querySelector(`.piece:not(.gone)[data-sq="${sq}"]`), x: e.clientX, y: e.clientY };
    return;
  }
  brush = e.button === 2 || tool === 'x' || kindAt(sq) === tool ? '' : tool;
  brushed = null;
  paint(sq);
}

function paint(sq) {
  if (!sq || sq === brushed) return;
  brushed = sq;
  edit.remove(sq);
  // one king a side, a new one moves it
  if (brush[1] === 'k') for (const s of edit.findPiece({ type: 'k', color: brush[0] })) edit.remove(s);
  if (brush) edit.put({ color: brush[0], type: brush[1] }, sq);
  editDraw();
}

el.board.oncontextmenu = e => e.preventDefault();
el.board.onpointerdown = e => {
  const sq = sqAt(e);
  if (!sq) return;
  el.board.setPointerCapture(e.pointerId);
  if (edit) return editDown(e, sq);
  // a right click drops the premoves like chess.com, else it draws
  if (e.button === 2 && pres.length) { pres = []; select(null); return drawBoard(); }
  if (e.button === 2) {
    draw = { from: sq, to: sq, color: 'grby'[(e.shiftKey || e.ctrlKey) + 2 * (e.altKey || e.metaKey)] };
    return drawShapes();
  }
  if (e.button !== 0) return;
  if (cur.shapes.length) { cur.shapes = []; drawShapes(); }
  if (dests.has(sq)) return tryMove(sel, sq);
  // on the engine's turn your pieces pick up as premoves, from where the premoves so far leave them. a click anywhere
  // else drops them all. a fight lost on time takes no more moves
  const early = engineMoves() && (pres.length ? planned() : game).get(sq)?.color === side;
  if (pres.length && !early) { pres = []; drawBoard(); }
  if (!early && (game.get(sq)?.color !== game.turn() || mode === 'fight' && (game.turn() !== side || clock?.flag))) return select(null);
  drag = { from: sq, el: el.pieces.querySelector(`.piece:not(.gone)[data-sq="${sq}"]`), x: e.clientX, y: e.clientY, wasSel: sel === sq };
  select(sq, early);
};
el.board.onpointermove = e => {
  const sq = sqAt(e);
  if (brush !== null) return paint(sq);
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
  brush = null;
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
  if (edit) {
    const p = sq !== d.from && edit.remove(d.from);  // dropped off the board it's gone
    if (p && sq) edit.put(p, sq);
    return editDraw();
  }
  if (sq !== d.from && dests.has(sq)) return tryMove(d.from, sq);
  if (sq === d.from && d.wasSel && !d.on) select(null);
  drawBoard();
};
el.board.onpointercancel = () => {
  drag?.el.classList.remove('drag');
  drag = draw = brush = null;
  drawBoard();
};

const lineEnd = () => walk(cur).at(-1);
const keys = {
  ArrowLeft: () => cur.parent, ArrowRight: () => cur.children[0],
  ArrowUp: () => root, Home: () => root, ArrowDown: lineEnd, End: lineEnd,
  ' ': () => pvs[0] && child(cur, pvs[0].pv[0]),
  f: () => { flipped = !flipped; orient(); drawBoard(true); },
  l: () => el.on.click(),
  p: () => setMode('fight'),
  e: () => setMode('edit'),
  r: () => { el.reviewBtn.ariaPressed = !reviewing(); reviewing() ? review() : stopReview(); drawReview(); },  // off keeps the grades
  Escape: cancelEdit,
};
const press = k => { const n = keys[k](); if (n && !edit) goto(n); };
onkeydown = e => {
  if (!keys[e.key] || e.ctrlKey || e.metaKey || e.altKey || e.target.matches('input, textarea, select')) return;
  e.preventDefault();
  press(e.key);
};
// the buttons take no focus, so space stays "play the best move"
el.ctrl.onmousedown = el.pvMore.onmousedown = el.optBtn.onmousedown = el.deeper.onmousedown = el.sideBtn.onmousedown = e => e.preventDefault();
el.pvMore.onclick = () => { el.pvMore.ariaExpanded = el.pv.classList.toggle('open'); };
el.ctrl.onclick = e => { const k = e.target.closest('button')?.dataset.key; if (k) press(k); };
el.moves.onclick = e => { const id = e.target.closest('[data-id]')?.dataset.id; if (id) goto(nodes[id]); };
el.graph.onclick = e => {
  const r = el.graph.getBoundingClientRect(), line = walk(root);
  goto(line[Math.round((e.clientX - r.left) / r.width * (line.length - 1))]);
};
el.note.onclick = e => {
  const i = e.target.closest('[data-i]')?.dataset.i;
  if (!noteLine || i == null) return;
  let n = noteLine.from;
  for (const u of noteLine.uci.slice(0, +i + 1)) n = child(n, u);
  goto(n);
};
el.pv.onpointermove = e => { if (e.pointerType !== 'touch') { hoverAt = [e.clientX, e.clientY]; preview(); } };
el.pv.onpointerleave = () => { hoverAt = null; preview(); };
el.pv.onclick = e => {
  const { l, i } = e.target.dataset;
  if (!i) return;
  let n = cur;
  for (const u of pvs[l].pv.slice(0, +i + 1)) n = child(n, u);
  goto(n);
};

// switching sides turns the board so yours is at the bottom and starts the clocks over, then the engine moves if it's
// now its turn (or stops)
el.sideBtn.onclick = () => {
  side = side === 'w' ? 'b' : 'w';
  if (flipped !== (side === 'b')) keys.f();
  select(null);
  drawSide();
  resetClock();
  analyse();
};

// the clock picker remembers its choice like the others, and a new one starts the clocks over
try { if ([...el.clock.options].some(o => o.value === localStorage['chess.clock'])) el.clock.value = localStorage['chess.clock']; } catch {}
el.clock.onchange = () => {
  try { localStorage['chess.clock'] = el.clock.value; } catch {}
  el.clock.blur();
  resetClock();
  analyse();
};

el.on.onchange = el.hints.onchange = analyse;
// the engine, lines and strength pickers remember their choice, one that isn't an option any more keeps the default.
// blur so arrow keys go back to the moves. another engine reviews the game again
for (const s of [el.engine, el.multipv, el.level]) {
  try { if ([...s.options].some(o => o.value === localStorage['chess.' + s.id])) s.value = localStorage['chess.' + s.id]; } catch {}
  s.onchange = () => {
    try { localStorage['chess.' + s.id] = s.value; } catch {}
    s.blur();
    if (s === el.engine) { resetReview(); drawOpts(); }
    goto(cur);
  };
}

// a changed option is saved for that engine (back at its default it's forgotten) and, like another engine, starts the
// search and the review again. verity's fight worker starts over too, it only takes options when it starts. an emptied
// box goes back to the default
el.optBtn.onclick = () => { el.optBtn.ariaExpanded = el.optBtn.ariaExpanded !== 'true'; };
el.optList.onchange = e => {
  const i = e.target, def = +i.dataset.def, t = tuned(el.engine.value);
  const v = i.value === '' ? def : clamp({ min: +i.min, max: +i.max }, +i.value);
  i.value = v;
  if (v === def) delete t[i.name]; else t[i.name] = v;
  retune(el.engine.value, t);
  i.parentNode.classList.toggle('changed', v !== def);
  el.optReset.disabled = !Object.keys(t).length;
  resetReview();
  unhunt();
  goto(cur);
};
el.optReset.onclick = () => { retune(el.engine.value, {}); drawOpts(); resetReview(); unhunt(); goto(cur); };

// the palette: the hand and eraser are in the page, a row of pieces goes after each
for (const c of 'wb') (c === 'w' ? el.hand : el.eraser).insertAdjacentHTML('afterend', [...'kqrbnp'].map(t =>
  `<button type="button" data-tool="${c + t}" aria-pressed="false" aria-label="${c === 'w' ? 'white' : 'black'} ${NAMES[t]}"
    style="background-image:${img(c + t)}"></button>`).join(''));
el.palette.onclick = e => {
  const b = e.target.closest('button');
  if (!b) return;
  tool = b.dataset.tool;
  for (const t of el.palette.children) t.ariaPressed = t === b;
};
el.editor.oninput = editDraw;
el.editStart.onclick = () => editLoad(START);
el.editClear.onclick = () => editLoad('8/8/8/8/8/8/8/8 w - - 0 1');
el.done.onclick = () => setMode('edit');
el.cancel.onclick = cancelEdit;

el.fen.onchange = () => {
  const fen = el.fen.value.trim();
  try { if (edit) editLoad(fen); else { newRoot(fen); goto(root); } } catch { el.fen.classList.add('bad'); }
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
// the board's squares are a whole number of screen pixels, else the squares' pattern (a background the browser rounds
// tile by tile) and the highlights (placed square by square) land up to a pixel apart. the size the css gives (--b) is
// trimmed to fit, again on every resize and zoom, which changes the pixel ratio
const main = document.querySelector('main');
function snap() {
  main.style.removeProperty('--b');
  const b = el.board.getBoundingClientRect().width, d = devicePixelRatio || 1;
  main.style.setProperty('--b', Math.floor(b * d / 8) * 8 / d + 'px');
}
addEventListener('resize', snap);
snap();

try { newRoot(decodeURIComponent(location.hash.slice(1)).replaceAll('_', ' ') || START); } catch { newRoot(START); }
orient();
drawSide();
goto(root);
drawOpts();
