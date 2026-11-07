// verityb.worker.js: browser VerityB as a web worker that speaks UCI. new Worker('<this folder>/verityb.worker.js'),
// post UCI commands as strings, every output line comes back as a message. Same protocol as browser Verity's
// verity.worker.js: a page that already compiled chess.wasm may post the WebAssembly.Module first, otherwise the worker
// fetches chess.wasm from its own folder on the first command. verityb.js, rules.js and the model (vbmodel.bin, 3.4
// MB, fetched on the first isready / go) load from this folder too. `go` ignores its limits: the search is
// node-counted (vbplay.py's), ~0.5 s a move.
'use strict';
importScripts('rules.js', 'verityb.js');
(function () {
  const dir = self.location.href.replace(/[^/]*$/, '');
  let sink = null, v = null, started = false;
  const early = [];

  function start(compiled) {
    started = true;
    self.Module = {
      print: l => sink && sink.push(l), printErr: () => {},
      postRun: [() => {
        const engine = cmd => { const out = sink = []; Module.ccall('uci', null, ['string'], [cmd]); sink = null; return out; };
        v = new VerityBUCI({
          engine, Chess: ChessRules.Chess,
          model: name => fetch(new URL(name, dir).href).then(r => {
            if (!r.ok) throw new Error(`${name}: HTTP ${r.status}`);
            return r.arrayBuffer();
          }),
          post: l => postMessage(l),
        });
        early.splice(0).forEach(c => v.send(c));
      }],
    };
    if (compiled) self.Module.instantiateWasm = (imports, done) => { WebAssembly.instantiate(compiled, imports).then(done); return {}; };
    importScripts('../chess.js');  // the site's shared glue (engines/chess.js), it still finds chess.wasm in this folder
  }

  self.onmessage = e => {
    if (e.data instanceof WebAssembly.Module) return started || start(e.data);
    if (v) return v.send(String(e.data));
    early.push(String(e.data));
    if (!started) start(null);
  };
})();
