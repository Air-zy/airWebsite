// analysis board. rules and san from lib/chess.js, the board is our own, the engine is a uci web worker (engines/)
import { Chess } from './lib/chess.js';

const START = new Chess().fen(), FILES = 'abcdefgh';
const NAMES = { k: 'king', q: 'queen', r: 'rook', b: 'bishop', n: 'knight', p: 'pawn' };
// arrow colours like lichess: right drag is green, shift red, alt blue, both yellow. the engine's best line is blue and
// its other lines grey
const BRUSH = { g: '#15781b', r: '#882020', b: '#003088', y: '#e68f00', k: '#4a4a4a' };
const INFO = /^info depth (\d+)(?: multipv (\d+))? score (cp|mate) (-?\d+) .*?nps (\d+) .*?pv ?(.*)/, BEST = /^bestmove (\S+)/;
// the king and rook squares each castling flag needs
const CASTLE = { K: ['e1', 'h1'], Q: ['e1', 'a1'], k: ['e8', 'h8'], q: ['e8', 'a8'] };
// review: how deep each position is searched, the grades and the material values for spotting a sacrifice
const DEPTH = 12, GRADES = { brilliant: '!!', inaccuracy: '?!', mistake: '?', blunder: '??' };
const VALUE = { p: 1, n: 3, b: 3, r: 5, q: 9 };

const el = Object.fromEntries([...document.querySelectorAll('[id]')].map(e => [e.id, e]));
let root, cur, game, nodes, flipped = false, sel = null, dests = new Map(), drag = null, draw = null;
let worker = null, reviewer = null, timer, pvs = [], mode = '';  // pvs: the engine's lines, best first. mode: '', 'fight' or 'edit'
// edit mode: the position being edited (it may not be legal yet), the palette tool ('' the hand, 'x' the eraser or a
// piece like 'wn') and what a held pointer paints (null when nothing, '' when erasing)
let edit = null, tool = '', brush = null, brushed;

const you = () => flipped ? 'b' : 'w';
// in a fight the engine plays the top side when it's that side's turn at the end of a line, so stepping back through
// the game doesn't make it move. without hints nothing runs on your move and its line and arrow stay hidden
const blind = () => mode === 'fight' && !el.hints.checked;
const engineMoves = () => mode === 'fight' && game.turn() !== you() && !cur.children.length;
// lines the engine searches: one when it plays the move, never more than there are moves (it prints just that many)
const want = () => engineMoves() ? 1 : Math.min(el.multipv.value, game.moves().length);

// a node is a position: the move that made it, its fen and the lines after it, children[0] is the main one
function newRoot(fen) {
  const err = fenError(fen);
  if (err) throw new Error(err);
  resetReview();
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
function syncPieces(fresh, box = el.pieces, g = edit || game) {
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

function drawSquares() {
  if (edit) return el.squares.replaceChildren();
  const extra = [];
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
  el.side.textContent = flipped ? 'black' : 'white';
  el.sideKing.style.backgroundImage = img(you() + 'k');
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

const mark = n => n.score?.grade ? `<em class="${n.score.grade}" title="${n.score.grade}">${GRADES[n.score.grade]}</em>` : '';
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
  const end = game.isCheckmate() ? 'checkmate' : game.isStalemate() ? 'stalemate'
    : game.isInsufficientMaterial() ? 'insufficient material' : game.isDraw() ? 'fifty moves' : '';
  // your move in a fight without hints: nothing runs, the last eval stays up
  const quiet = !end && blind() && game.turn() === you(), best = pvs[0];
  let white = null, score = '', info = quiet ? 'your move' : el.on.checked || engineMoves() ? 'thinking' : 'engine off';
  if (end) {
    white = end === 'checkmate' ? +(game.turn() === 'b') : .5;  // white's share of the gauge
    score = ['0-1', '½-½', '1-0'][white * 2];
    info = end;
  } else if (best) {
    white = (1 + chance(best)) / 2;
    score = fmt(best);
    info = `depth ${best.depth} · ${Math.round(best.nps / 1000).toLocaleString()} kn/s`;
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

const wasm = {};  // engine folder -> its compiled chess.wasm

// a worker running the chosen engine, a folder under engines/ holding just its chess.wasm (the worker and its glue are
// shared). the wasm is compiled once and handed over, a failed compile is dropped so the next worker tries again
function spawn() {
  const dir = `/chess/engines/${el.engine.value}/`, w = new Worker('/chess/engines/engine.worker.js');
  (wasm[dir] ??= WebAssembly.compileStreaming(fetch(dir + 'chess.wasm'))).then(m => w.postMessage(m), () => { delete wasm[dir]; w.onerror(); });
  return w;
}

const position = n => `position fen ${root.fen} moves ${path(n).join(' ')}`;
// an engine info line at node n in white's view: depth, which line (1 without multipv), cp or mate, nps and the moves
const parse = (line, n) => {
  const m = INFO.exec(line);
  return m && { depth: +m[1], k: +(m[2] ?? 1), [m[3]]: m[4] * (n.ply % 2 ? -1 : 1), nps: +m[5], pv: m[6].split(' ').filter(Boolean) };
};

// avy: the wasm build can't take a stop mid search, so a new position kills the worker and starts a fresh one and the
// hash goes with it. a pthreads build with stop would keep one worker. the wait lets arrow keys skim through moves
// without spinning one up for each
function analyse() {
  clearTimeout(timer);
  worker?.terminate();
  worker = null;
  pvs = [];
  drawEval();
  drawShapes();
  const plays = engineMoves();
  if (edit || game.isGameOver() || !plays && (!el.on.checked || blind() && game.turn() === you())) return;
  timer = setTimeout(() => {
    const n = cur, w = worker = spawn(), lines = want(), side = n.ply % 2 ? -1 : 1;
    let got = [];
    w.onmessage = e => {
      if (w !== worker) return;
      // it searches the start position instead, so its lines wouldn't fit this one
      if (e.data.startsWith('info string invalid fen')) { worker = null; w.terminate(); el.info.textContent = 'the engine refused this position'; return; }
      const info = parse(e.data, n), best = plays && BEST.exec(e.data);
      if (best) return goto(child(n, best[1]));
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
    w.onerror = () => { el.info.textContent = 'engine failed to load, try another move'; };
    w.postMessage(`setoption name MultiPV value ${lines}`);
    w.postMessage(position(n));
    // a fight move searches as the strength picker says (its values are go args), analysis is capped so an idle tab
    // doesn't spin the fan forever
    w.postMessage(`go ${plays ? el.level.value : 'movetime 30000'}`);
  }, 150);
}

const reviewing = () => el.reviewBtn.ariaPressed === 'true';
const lead = fen => [...fen.split(' ')[0]].reduce((s, c) => s + (VALUE[c.toLowerCase()] ?? 0) * (c < 'a' ? 1 : -1), 0);  // white's material lead
const accuracy = loss => Math.min(100, Math.max(0, 103.1668 * Math.exp(-0.04354 * loss * 50) - 3.1669));  // lichess's, per move

// review: one worker scores the main line position by position. a search to a fixed depth ends by itself, so unlike
// live analysis the worker lives through the whole game and keeps its hash. the next position is always the first
// unscored one, so moves added meanwhile get picked up. a score is white's win chance (-1..1), the best move and the line
function review() {
  if (reviewer) return;
  const w = reviewer = spawn();
  let n, last;
  const next = () => {
    n = walk(root).find(n => !n.score);
    if (!n) { w.terminate(); reviewer = null; return drawReview(); }
    const g = new Chess(n.fen);
    if (g.isGameOver()) return scored(n, { win: g.isCheckmate() ? (g.turn() === 'w' ? -1 : 1) : 0, mate: g.isCheckmate(), pv: [] }), next();
    last = null;
    w.postMessage(position(n));
    w.postMessage(`go depth ${DEPTH}`);
  };
  w.onmessage = e => {
    if (w !== reviewer) return;
    last = parse(e.data, n) ?? last;
    const best = BEST.exec(e.data);
    if (!best) return;
    scored(n, { win: last ? chance(last) : n.parent?.score.win ?? 0, mate: last?.mate != null, best: best[1], pv: last?.pv ?? [] });
    next();
  };
  w.onerror = () => { reviewer = null; el.stats.textContent = 'engine failed to load, press review again'; };
  next();
}

function scored(n, s) {
  n.score = s;
  if (n.parent) grade(n);
  el.moves.querySelector(`[data-id="${n.id}"]`)?.insertAdjacentHTML('beforeend', mark(n));
  drawReview();
}

const stopReview = () => { reviewer?.terminate(); reviewer = null; };
// scores belong to one engine and one tree
function resetReview() {
  stopReview();
  for (const n of nodes ?? []) delete n.score;
}

// lichess's grades on the win chance the mover gave away. brilliant is our guess at chess.com's: the engine's own move,
// a piece or more down after the reply and still down two moves later, from a position that wasn't already won (unless
// the sacrifice mates) and isn't lost after
function grade(n) {
  const s = n.parent.ply % 2 ? -1 : 1, before = s * n.parent.score.win, after = s * n.score.win;
  const loss = n.score.loss = Math.max(0, before - after);
  if (loss >= .1) return n.score.grade = loss >= .3 ? 'blunder' : loss >= .2 ? 'mistake' : 'inaccuracy';
  const g = new Chess(n.fen), was = s * lead(n.parent.fen);
  const down = n.score.pv.slice(0, 4).map(u => (g.move(uciMove(u)), s * lead(g.fen()) - was));
  if (n.uci === n.parent.score.best && down[0] <= -2 && down.at(-1) <= -2 && after > -.3 && (before < .7 || n.score.mate && after > 0))
    n.score.grade = 'brilliant';
}

// the eval graph (white's win chance, lichess style: white's area under the line) with the grades as ticks and where
// you are, then per side accuracy (avy: a plain mean of lichess's per move accuracy, lichess weights it by volatility)
// and grade counts. the stats are a live region kept busy while the review runs, so a screen reader hears the result once
function drawReview() {
  if (!reviewing()) return;
  const line = walk(root);
  el.stats.ariaBusy = !!reviewer;
  if (line.length < 2) { el.graph.replaceChildren(); el.stats.innerHTML = '<p>play or import a game to review it</p>'; return; }
  const done = line.filter(n => n.score), pts = done.map((n, i) => `${i},${1 - n.score.win}`), here = line.indexOf(cur);
  el.graph.setAttribute('viewBox', `0 0 ${Math.max(line.length - 1, 1)} 2`);
  el.graph.innerHTML = `<line class="mid" x1="0" x2="${line.length}" y1="1" y2="1"/>`
    + (pts.length ? `<path class="area" d="M0,2L${pts.join('L')}L${pts.length - 1},2Z"/><path class="curve" d="M${pts.join('L')}"/>` : '')
    + done.map((n, i) => n.score.grade ? `<line class="${n.score.grade}" x1="${i}" x2="${i}" y1="0" y2=".45"/>` : '').join('')
    + (here < 0 ? '' : `<line class="here" x1="${here}" x2="${here}" y1="0" y2="2"/>`);
  el.stats.innerHTML = ['white', 'black'].map((name, p) => {
    const moves = done.filter(n => n.parent && n.parent.ply % 2 === p);
    const acc = moves.length ? Math.round(moves.reduce((s, n) => s + accuracy(n.score.loss), 0) / moves.length) + '%' : '–';
    return `<b>${name}</b><span>${acc}</span>` + Object.keys(GRADES).map(g => {
      const k = moves.filter(n => n.score.grade === g).length;
      return `<span class="${g}${k ? '' : ' none'}" title="${g}">${GRADES[g]} ${k}</span>`;
    }).join('');
  }).join('') + (done.length < line.length ? `<p>reviewing at depth ${DEPTH}, ${done.length} of ${line.length} positions</p>` : '');
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
  if (reviewing()) review();
  drawReview();
  history.replaceState(null, '', n.fen === START ? location.pathname : '#' + n.fen.replaceAll(' ', '_'));
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
  if (e.button === 2) {
    draw = { from: sq, to: sq, color: 'grby'[(e.shiftKey || e.ctrlKey) + 2 * (e.altKey || e.metaKey)] };
    return drawShapes();
  }
  if (e.button !== 0) return;
  if (cur.shapes.length) { cur.shapes = []; drawShapes(); }
  if (dests.has(sq)) return tryMove(sel, sq);
  if (game.get(sq)?.color !== game.turn() || mode === 'fight' && game.turn() !== you()) return select(null);
  drag = { from: sq, el: el.pieces.querySelector(`.piece:not(.gone)[data-sq="${sq}"]`), x: e.clientX, y: e.clientY, wasSel: sel === sq };
  select(sq);
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
  f: () => { flipped = !flipped; orient(); drawBoard(true); if (mode === 'fight') analyse(); },  // in a fight that swaps sides
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
el.ctrl.onmousedown = el.pvMore.onmousedown = e => e.preventDefault();
el.pvMore.onclick = () => { el.pvMore.ariaExpanded = el.pv.classList.toggle('open'); };
el.ctrl.onclick = e => { const k = e.target.closest('button')?.dataset.key; if (k) press(k); };
el.moves.onclick = e => { const id = e.target.closest('[data-id]')?.dataset.id; if (id) goto(nodes[id]); };
el.graph.onclick = e => {
  const r = el.graph.getBoundingClientRect(), line = walk(root);
  goto(line[Math.round((e.clientX - r.left) / r.width * (line.length - 1))]);
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

el.on.onchange = el.hints.onchange = analyse;
// the engine, lines and strength pickers remember their choice, one that isn't an option any more keeps the default.
// blur so arrow keys go back to the moves. another engine reviews the game again
for (const s of [el.engine, el.multipv, el.level]) {
  try { if ([...s.options].some(o => o.value === localStorage['chess.' + s.id])) s.value = localStorage['chess.' + s.id]; } catch {}
  s.onchange = () => {
    try { localStorage['chess.' + s.id] = s.value; } catch {}
    s.blur();
    if (s === el.engine) resetReview();
    goto(cur);
  };
}

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
try { newRoot(decodeURIComponent(location.hash.slice(1)).replaceAll('_', ' ') || START); } catch { newRoot(START); }
orient();
goto(root);
