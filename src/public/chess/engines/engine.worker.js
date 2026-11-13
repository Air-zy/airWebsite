// web worker around the emscripten glue chess.js (same folder), shared by every engine. the page compiles the chosen
// engine's chess.wasm once and posts it here, uci commands go in and output lines come back. 'ready' comes once the
// wasm is up, commands posted before that are queued. an engine built with other imports brings its own chess.js, the
// page then names its folder in the url's hash (#suimate/)
const queue = [], uci = cmd => Module.ccall('uci', null, ['string'], [cmd]);
let ready = false, gotWasm;
const wasm = new Promise(r => gotWasm = r);
self.Module = {
  print: line => postMessage(line), postRun: [() => { ready = true; postMessage('ready'); queue.splice(0).forEach(uci); }],
  // a failed instantiate (a phone short on memory, most likely) is thrown again outside the promise, so it reaches the
  // page's onerror instead of leaving the worker silent
  instantiateWasm: (imports, done) => wasm.then(m => WebAssembly.instantiate(m, imports)).then(done, e => setTimeout(() => { throw e; })),
};
importScripts(location.hash.slice(1) + 'chess.js');
onmessage = e => e.data instanceof WebAssembly.Module ? gotWasm(e.data) : ready ? uci(e.data) : queue.push(e.data);
