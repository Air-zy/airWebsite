// verityb.js: browser VerityB = the Verity engine (chess.js + chess.wasm) + a learned "human bonus", NO human model at
// play time. A port of vbplay.py (C:\Users\Airzy\nn\night\antihuman\vb\vbplay.py), model v2 (vb-gbm2.pkl, exported to
// vbmodel.bin by vbexport.py). Defaults = the best tested setup: 19.93 moves to mate a ~1400 (Maia-3 5m, sampled) on
// average over 2000 games (plain Verity, same search: 22.46), ~0.5 s a move natively.
//
// At each of our moves: Verity's top K moves (MultiPV, N0 nodes); those within Margin cp of the best are candidates.
// For each candidate, the position after it gets 70 numbers: board features (material, mobility, king safety, hanging
// pieces), a one-ply look at the human's options (how many of their moves hang a piece or allow mate in one), and
// Verity's quick score of every human reply (MultiPV 256 at RNodes, 'position fen'). Boosted trees turn them into the
// bonus d = the expected moves saved against a human beyond plain minimax (learned from the Maia search's labels).
// Play argmax(u + Lam d), u = minus the moves left to mate by Verity's score (the ml1 curve). A pick other than
// Verity's top is first searched on its own (Verify nodes, MultiPV 1): if it drops below top - Margin, the next is
// tried (MultiPV lines below the first can miss a refutation).
//
// One engine does both searches in the browser (vbplay.py uses a second process for the reply scores, with its own
// hash), so play there is the same method but not move-for-move identical to vbplay.py. Given env.reply (a second
// engine, tests/match.test.js) it is identical.
//
// Used by verityb.worker.js (browser) and uci.js (node). Loads as a classic script (sets VerityBUCI) or a CommonJS
// module.
(function (g) {
  'use strict';

  // ml1.json's knots (mlfit.py, won games vs Maia): Verity's cp -> our moves left to mate
  const KNOTS = [[-135, 21.82], [-51, 21.15], [59, 19.38], [128, 19.02], [173, 18.38], [225, 18.1], [275, 17.24],
    [326, 16.59], [376, 16.51], [424, 15.48], [474, 14.82], [524, 14.25], [575, 13.58], [649, 12.89], [748, 11.38],
    [893, 10.11], [1139, 8.63], [2308, 6.34]];

  const DEFAULTS = { K: 12, Margin: 500, N0: 400000, RNodes: 20000, Verify: 100000, Lam: 1.0, Model: 'vbmodel.bin',
    Zero: false, MinPly: 0 };
  const ENGINE_DEFAULTS = [['HuntW', 250], ['HuntC', 25], ['HuntT', 400], ['Hash', 16]];
  const OPTION_LINES = [
    'option name K type spin default 12 min 1 max 64',
    'option name Margin type spin default 500 min 0 max 30000',
    'option name N0 type spin default 400000 min 1 max 1000000000',
    'option name RNodes type spin default 20000 min 1 max 1000000000',
    'option name Verify type spin default 100000 min 0 max 1000000000',
    'option name Lam type string default 1.0',
    'option name Model type string default vbmodel.bin',
    'option name Zero type check default false',
    'option name MinPly type spin default 0 min 0 max 1000',
  ];

  // ---- the trees (sklearn HistGradientBoostingRegressor, vbexport.py's layout) ----
  class Trees {
    constructor(buf) {
      const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
      const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
      if (String.fromCharCode(u8[0], u8[1], u8[2], u8[3]) !== 'VBM1') throw new Error('not a VerityB model');
      this.nf = dv.getInt32(4, true); this.nt = dv.getInt32(8, true);
      const nn = dv.getInt32(12, true);
      this.base = dv.getFloat64(16, true);
      let o = 24;
      this.thr = new Float64Array(nn); for (let i = 0; i < nn; i++) this.thr[i] = dv.getFloat64(o + 8 * i, true);
      o += 8 * nn;
      this.left = new Int32Array(nn); for (let i = 0; i < nn; i++) this.left[i] = dv.getInt32(o + 4 * i, true);
      o += 4 * nn;
      this.right = new Int32Array(nn); for (let i = 0; i < nn; i++) this.right[i] = dv.getInt32(o + 4 * i, true);
      o += 4 * nn;
      this.feat = new Int16Array(nn); for (let i = 0; i < nn; i++) this.feat[i] = dv.getInt16(o + 2 * i, true);
      o += 2 * nn;
      this.start = new Int32Array(this.nt); for (let i = 0; i < this.nt; i++) this.start[i] = dv.getInt32(o + 4 * i, true);
    }

    // baseline + each tree's leaf, in order (sklearn's sum). vbplay.py hands sklearn a float32 row: round the same
    predict(x) {
      if (x.length !== this.nf) throw new Error(`model wants ${this.nf} features, got ${x.length}`);
      const f = Float64Array.from(x, Math.fround), thr = this.thr, L = this.left, R = this.right, F = this.feat;
      let s = this.base;
      for (let t = 0; t < this.nt; t++) {
        let n = this.start[t];
        while (F[n] >= 0) n = f[F[n]] <= thr[n] ? L[n] : R[n];
        s += thr[n];
      }
      return s;
    }
  }

  // ---- the features (vbfeat.py, vbfeat2.py, vbfeat3.py; python-chess semantics on chess.js's 0x88 board) ----
  const VAL1 = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };    // mlfeat.py's
  const VAL2 = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 };  // vbfeat2.py's
  const CAPTURE = 2, EP_CAPTURE = 8;                      // chess.js BITS
  const STEPS = [-17, -16, -15, -1, 1, 15, 16, 17];
  const other = c => (c === 'w' ? 'b' : 'w');
  const alg = i => 'abcdefgh'[i & 15] + '87654321'[i >> 4];
  const ox = s => (7 - (s >> 3)) * 16 + (s & 7);           // python-chess square (a1 = 0) -> 0x88
  const sqOf = a => (8 - +a[1]) * 16 + (a.charCodeAt(0) - 97);
  const uciOf = m => alg(m.from) + alg(m.to) + (m.promotion || '');
  const isCap = m => (m.flags & (CAPTURE | EP_CAPTURE)) !== 0;
  const near = i => STEPS.map(d => i + d).filter(j => !(j & 0x88));

  // does m (the side to move's, legal or pseudo-legal) check the other king? python-chess: a captured king = no check
  function givesCheck(c, m) {
    if (m.captured === 'k') return false;
    const them = other(c._turn);
    c._makeMove(m);
    const chk = c._isKingAttacked(them);
    c._undoMove();
    return chk;
  }

  function kingFeats(c, side) {  // mlfeat.king_feats: side's king against the other side
    const k = c._kings[side], opp = other(side), nb = near(k), atk = new Set();
    let att = 0;
    for (const s of nb.concat([k])) {
      if (c._attacked(opp, s)) att++;
      for (const a of c._attacked(opp, s, true)) atk.add(a);
    }
    const f = k & 15, r = 7 - (k >> 4), home = side === 'w' ? r : 7 - r, fwd = side === 'w' ? 1 : -1;
    let shield = 0, esc = 0;
    for (const df of [-1, 0, 1])
      for (const dr of [1, 2]) {
        const ff = f + df, rr = r + fwd * dr;
        if (ff < 0 || ff > 7 || rr < 0 || rr > 7) continue;
        const p = c._board[ox(rr * 8 + ff)];
        if (p && p.type === 'p' && p.color === side) shield++;
      }
    for (const s of nb) {
      const p = c._board[s];
      if (!c._attacked(opp, s) && !(p && p.color === side)) esc++;
    }
    return [att, atk.size, home, Math.min(f, 7 - f), shield, esc];
  }

  function hanging(c, side) {  // mlfeat.hanging: side's pieces attacked and not defended, and their value
    let n = 0, v = 0;
    for (let i = 0; i < 120; i++) {
      if (i & 0x88) continue;
      const p = c._board[i];
      if (!p || p.color !== side || p.type === 'k') continue;
      if (c._attacked(other(side), i) && !c._attacked(side, i)) { n++; v += VAL1[p.type]; }
    }
    return [n, v];
  }

  // vbfeat.feats: c = the position after our candidate (the human to move), legal = the human's legal moves
  function handFeats(c, legal, u, ply, utop, ncand) {
    const H = c._turn, V = other(H);
    let matV = 0, matH = 0, qV = 0, qH = 0, pieces = 0;
    for (let i = 0; i < 120; i++) {
      if (i & 0x88) continue;
      const p = c._board[i];
      if (!p) continue;
      pieces++;
      if (p.color === V) { matV += VAL1[p.type]; qV += p.type === 'q'; } else { matH += VAL1[p.type]; qH += p.type === 'q'; }
    }
    let hchecks = 0, hcaps = 0;
    for (const m of legal) { hchecks += givesCheck(c, m); hcaps += isCap(m); }
    // Verity's pseudo-legal moves as if it were to move again (no en passant)
    const parts = c.fen().split(' ');
    parts[1] = V; parts[3] = '-';
    const nb = new c.constructor(parts.join(' '), { skipValidation: true }), vps = nb._moves({ legal: false });
    let vchecks = 0, vcaps = 0;
    for (const m of vps) { vchecks += givesCheck(nb, m); vcaps += isCap(m); }
    return [u, ply, V === 'w' ? 1 : 0, matV, matH, matV - matH, qV, qH, pieces, legal.length, hchecks, hcaps,
      c._isKingAttacked(H) ? 1 : 0, vps.length, vchecks, vcaps, ...kingFeats(c, H), ...kingFeats(c, V),
      ...hanging(c, H), ...hanging(c, V), u - utop, ncand];
  }

  // vbfeat2.one: does each human move lose at once (hangs a 3+ piece, or allows mate in one)?
  function blunderFeats(c, legal) {
    const H = c._turn;
    let n = 0, hangs = 0, mates = 0, safe = 0, scap = 0, lcap = 0, schk = 0, squiet = 0;
    for (const m of legal) {
      const cap = isCap(m), chk = givesCheck(c, m);
      c._makeMove(m);
      const vl = c._moves();
      let hang = false, mate = false;
      for (const x of vl) {
        if (!(x.flags & CAPTURE)) continue;  // en passant: python-chess finds no piece on the square, skipped
        const vv = VAL2[x.captured];
        if (vv < 3) continue;
        if (vv > VAL2[x.piece] || !c._attacked(H, x.to)) { hang = true; break; }
      }
      for (const x of vl) {
        if (!givesCheck(c, x)) continue;
        c._makeMove(x);
        const mt = c._moves().length === 0;
        c._undoMove();
        if (mt) { mate = true; break; }
      }
      c._undoMove();
      n++; hangs += hang; mates += mate;
      const bad = hang || mate;
      safe += !bad;
      if (cap) { scap += !bad; lcap += bad; }
      if (chk && !bad) schk++;
      if (!cap && !chk && !bad) squiet++;
    }
    return [n, hangs, mates, safe, safe / Math.max(1, n), scap, lcap, schk, squiet, safe === 1 ? 1 : 0];
  }

  // numpy's pairwise sum (float64 reduce), so the soft features round as in vbfeat3.py
  function pwsum(a, lo = 0, n = a.length) {
    if (n < 8) { let r = 0; for (let i = 0; i < n; i++) r += a[lo + i]; return r; }
    if (n <= 128) {
      const r = a.slice(lo, lo + 8);
      let i = 8;
      for (; i < n - (n % 8); i += 8) for (let j = 0; j < 8; j++) r[j] += a[lo + i + j];
      let res = ((r[0] + r[1]) + (r[2] + r[3])) + ((r[4] + r[5]) + (r[6] + r[7]));
      for (; i < n; i++) res += a[lo + i];
      return res;
    }
    let n2 = Math.floor(n / 2);
    n2 -= n2 % 8;
    return pwsum(a, lo, n2) + pwsum(a, lo + n2, n - n2);
  }

  const cpOf = (kind, val) => (kind === 'cp' ? val : (val > 0 ? 30000 - val : -30000 - val));
  const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

  // vbfeat3.feats: from Verity's scores of every human reply (rep = [[uci, kind, val, depth]], human's view)
  function replyFeats(c, legal, last, rep) {
    if (!rep.length) return new Array(26).fill(0);
    const byUci = new Map(legal.map(m => [uciOf(m), m])), sc = new Map();
    for (const [m, k, v] of rep) sc.set(m, clamp(cpOf(k, v), -30000, 30000));
    let best = -Infinity;
    for (const s of sc.values()) best = Math.max(best, s);
    const keys = [...sc.keys()], S = keys.map(m => sc.get(m)), L = S.map(s => Math.min(2000, best - s)), n = L.length;
    const srt = S.slice().sort((a, b) => b - a), gap = n > 1 ? Math.min(1000, srt[0] - srt[1]) : 1000;
    const Lc = L.map(x => Math.min(x, 1000)), soft = [];
    for (const T of [100, 200, 400]) {
      const w = S.map(s => Math.exp((clamp(s, -3000, 3000) - best) / T));
      soft.push(pwsum(w.map((x, i) => x * Lc[i])) / pwsum(w));
    }
    const sorted = Lc.slice().sort((a, b) => a - b);
    const median = n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
    const cnt = p => L.filter(p).length;
    const f = [n, clamp(best, -2000, 2000)];
    for (const t of [100, 200, 400, 800]) f.push(cnt(x => x >= t));
    for (const t of [100, 200, 400, 800]) f.push(cnt(x => x >= t) / n);
    f.push(cnt(x => x <= 30), cnt(x => x <= 100), gap, S.filter(s => s <= -29000).length, pwsum(Lc) / n, median, ...soft);
    const to = sqOf(last.slice(2, 4)), caps = [], chks = [], rec = [];
    keys.forEach((m, i) => {
      const mv = byUci.get(m);
      if (!mv) return;
      if (isCap(mv)) { caps.push(L[i]); if (mv.to === to) rec.push(L[i]); }
      if (givesCheck(c, mv)) chks.push(L[i]);
    });
    f.push(caps.length, caps.length ? caps.filter(x => x >= 300).length / caps.length : 0,
      caps.length ? Math.min(...caps) : 2000);
    f.push(chks.length, chks.length ? chks.filter(x => x >= 300).length / chks.length : 0);
    f.push(rec.length ? 1 : 0, rec.length ? Math.min(...rec) : 2000);
    return f;
  }

  // all 70: c = chess.js board after our candidate `move`, rep = the reply scores of that position
  function features(c, move, u, ply, utop, ncand, rep) {
    const legal = c._moves();
    return handFeats(c, legal, u, ply, utop, ncand).concat(blunderFeats(c, legal), replyFeats(c, legal, move, rep));
  }

  // ---- the UCI engine ----
  class VerityBUCI {
    // env: { engine: cmd -> [output lines] (sync), Chess, model: name -> Promise of ArrayBuffer / Uint8Array,
    // post: line -> () }
    constructor(env) {
      this.env = env;
      this.o = Object.assign({}, DEFAULTS);
      this.mpv = null;
      this.base = 'startpos';
      this.fen = null;
      this.rootMoves = [];
      this.trees = null;
      this.treesName = null;
      this.engineLines = env.engine('uci').filter(l => l.startsWith('option name') && !/^option name MultiPV /.test(l));
      for (const [k, v] of ENGINE_DEFAULTS) env.engine(`setoption name ${k} value ${v}`);
      // env.reply (optional, tests): a second engine for the reply scores, as vbplay.py's (own hash, MultiPV 256, never
      // a ucinewgame), so play matches vbplay.py move for move
      if (env.reply) {
        env.reply('uci');
        for (const [k, v] of ENGINE_DEFAULTS) env.reply(`setoption name ${k} value ${v}`);
        env.reply('setoption name MultiPV value 256');
        env.reply('isready');
      }
      this.queue = Promise.resolve();
    }

    send(line) {
      this.queue = this.queue.then(() => this.handle(line.trim())).catch(e => this.env.post(`info string error ${e && e.message || e}`));
      return this.queue;
    }

    async model() {
      if (this.o.Zero) return null;
      if (!this.trees || this.treesName !== this.o.Model) {
        this.trees = new Trees(await this.env.model(this.o.Model));
        this.treesName = this.o.Model;
      }
      return this.trees;
    }

    async handle(line) {
      const t = line.split(/\s+/), post = this.env.post;
      switch (t[0]) {
        case 'uci':
          post('id name VerityB' + (this.o.Zero ? ' zero' : ''));
          post('id author Gojo');
          for (const l of this.engineLines.concat(OPTION_LINES)) post(l);
          post('uciok');
          break;
        case 'isready':
          await this.model();
          this.env.engine('isready');
          post('readyok');
          break;
        case 'setoption': {
          const i = t.indexOf('value'), name = t.slice(2, i < 0 ? t.length : i).join(' ');
          const value = i < 0 ? '' : t.slice(i + 1).join(' ');
          if (name in DEFAULTS) {
            const d = DEFAULTS[name];
            this.o[name] = typeof d === 'boolean' ? value === 'true' : typeof d === 'number' ? +value : value;
          } else if (name !== 'MultiPV') this.env.engine(`setoption name ${name}` + (i < 0 ? '' : ` value ${value}`));
          break;
        }
        case 'ucinewgame':
          this.env.engine('ucinewgame');
          this.env.engine('isready');
          this.base = 'startpos'; this.fen = null; this.rootMoves = [];
          break;
        case 'position': {
          const mi = t.indexOf('moves');
          if (t[1] === 'fen') { this.fen = t.slice(2, mi < 0 ? t.length : mi).join(' '); this.base = 'fen ' + this.fen; }
          else { this.fen = null; this.base = 'startpos'; }
          this.rootMoves = mi < 0 ? [] : t.slice(mi + 1);
          break;
        }
        case 'go': {
          const t0 = Date.now();
          const { move, line: l, rec } = await this.choose();
          if (l) post(`info depth ${l.depth} score ${l.kind} ${l.val} pv ${move}`);
          if (rec) { rec.ms = Date.now() - t0; post('info string verityb ' + JSON.stringify(rec)); }
          post(`bestmove ${move}`);
          break;
        }
        case 'd': case 'eval': case 'bench':
          for (const l of this.env.engine(line)) post(l);
          break;
        default:  // quit, stop (go blocks: nothing to stop), unknown
      }
    }

    movesLeft(cp) {
      const k = KNOTS;
      if (cp <= k[0][0]) return k[0][1] + (k[0][0] - cp) / 100;
      for (let i = 0; i + 1 < k.length; i++) {
        const [x0, y0] = k[i], [x1, y1] = k[i + 1];
        if (cp <= x1) return y0 + (y1 - y0) * (cp - x0) / (x1 - x0);
      }
      const [x0, y0] = k[k.length - 2], [x1, y1] = k[k.length - 1];
      return Math.max(2.0, y1 + (y1 - y0) * (cp - x1) / (x1 - x0));
    }

    util(kind, val) { return kind === 'cp' ? -this.movesLeft(val) : (val > 0 ? -val : -100); }

    setMpv(n) { if (n !== this.mpv) { this.env.engine(`setoption name MultiPV value ${n}`); this.mpv = n; } }

    // the last reported line of each MultiPV slot
    search(moves, nodes, multipv) {
      const E = this.env.engine;
      this.setMpv(multipv);
      E(`position ${this.base}` + (moves.length ? ' moves ' + moves.join(' ') : ''));
      const lines = new Map(), out = E(`go nodes ${nodes}`);
      let best = null;
      for (const raw of out) {
        const t = raw.trim().split(/\s+/);
        if (t[0] === 'bestmove') { best = t[1]; continue; }
        if (t[0] !== 'info' || !t.includes('pv') || !t.includes('score')) continue;
        const i = t.indexOf('score'), kind = t[i + 1], val = parseInt(t[i + 2], 10);
        const mpv = t.includes('multipv') ? parseInt(t[t.indexOf('multipv') + 1], 10) : 1;
        const pv = t.slice(t.indexOf('pv') + 1);
        if (pv.length)
          lines.set(mpv, { u: this.util(kind, val), cp: cpOf(kind, val), kind, val, move: pv[0],
            depth: parseInt(t[t.indexOf('depth') + 1], 10) });
      }
      return { best, lines };
    }

    // every legal human move's last reported line (vbreply.py's format, the human's view): [[uci, kind, val, depth]]
    replies(fen, nodes) {
      const E = this.env.reply || this.env.engine;
      if (!this.env.reply) this.setMpv(256);
      E(`position fen ${fen}`);
      const out = new Map();
      for (const raw of E(`go nodes ${nodes}`)) {
        const t = raw.trim().split(/\s+/);
        if (t[0] !== 'info' || !t.includes('pv') || !t.includes('score')) continue;
        const i = t.indexOf('score'), pv = t.slice(t.indexOf('pv') + 1);
        if (pv.length) out.set(pv[0], [t[i + 1], parseInt(t[i + 2], 10), parseInt(t[t.indexOf('depth') + 1], 10)]);
      }
      return [...out].map(([m, v]) => [m, ...v]);
    }

    // our cp after our move mv, searched on its own (MultiPV 1 on the position after it)
    verify(moves, mv, nodes) {
      const { lines } = this.search(moves.concat([mv]), nodes, 1);
      return lines.has(1) ? -lines.get(1).cp : null;
    }

    async choose() {
      const o = this.o, moves = this.rootMoves.slice(), trees = await this.model();
      const { best, lines } = this.search(moves, o.N0, o.K);
      if (!lines.has(1)) return { move: best, line: null, rec: null };
      const top = lines.get(1), rec = { ply: moves.length, top: top.move, tu: top.u };
      if (top.kind === 'mate' || lines.size === 1) return { move: top.move, line: top, rec };
      const cands = [], seen = new Set();
      for (const i of [...lines.keys()].sort((a, b) => a - b)) {
        const l = lines.get(i);
        if (!seen.has(l.move) && l.cp >= top.cp - o.Margin) cands.push(l);
        seen.add(l.move);
      }
      if (cands.length === 1 || o.Zero || moves.length < o.MinPly) {
        Object.assign(rec, { pick: top.move, c: cands.map(cd => [cd.move, +cd.u.toFixed(2)]) });
        return { move: top.move, line: top, rec };
      }
      const utop = Math.max(...cands.map(c => c.u));
      const c = this.fen ? new this.env.Chess(this.fen) : new this.env.Chess();
      for (const m of moves) c.move({ from: m.slice(0, 2), to: m.slice(2, 4), promotion: m[4] });
      const dh = [];
      for (const cd of cands) {
        c.move({ from: cd.move.slice(0, 2), to: cd.move.slice(2, 4), promotion: cd.move[4] });
        const rep = this.replies(c.fen(), o.RNodes);
        dh.push(trees.predict(features(c, cd.move, cd.u, moves.length, utop, cands.length, rep)));
        c.undo();
      }
      const sc = cands.map((cd, i) => cd.u + o.Lam * dh[i]), order = cands.map((_, i) => i).sort((a, b) => sc[b] - sc[a]);
      let pick = top;
      const rej = [];
      for (const j of order) {
        const cd = cands[j];
        if (cd.move === top.move || !o.Verify) { pick = cd; break; }
        const v = this.verify(moves, cd.move, o.Verify);
        if (v !== null && v >= top.cp - o.Margin) { pick = cd; break; }
        rej.push([cd.move, cd.cp, v]);
      }
      Object.assign(rec, { pick: pick.move, c: cands.map((cd, i) => [cd.move, +cd.u.toFixed(2), +dh[i].toFixed(2)]) });
      if (rej.length) rec.rej = rej;
      return { move: pick.move, line: pick, rec };
    }
  }

  g.VerityBUCI = VerityBUCI;
  if (typeof module === 'object' && module.exports) module.exports = { VerityBUCI, Trees, features };
})(globalThis);
