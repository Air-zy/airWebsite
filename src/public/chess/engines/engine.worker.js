// web worker around the emscripten glue chess.js (same folder), shared by every engine. the page compiles the chosen
// engine's chess.wasm once and posts it here, uci commands go in and output lines come back. 'ready' comes once the
// wasm is up, commands posted before that are queued
const queue = [], uci = cmd => Module.ccall('uci', null, ['string'], [cmd]);
let ready = false, gotWasm;
const wasm = new Promise(r => gotWasm = r);
self.Module = {
  print: line => postMessage(line), postRun: [() => { ready = true; postMessage('ready'); queue.splice(0).forEach(uci); }],
  instantiateWasm: (imports, done) => wasm.then(m => WebAssembly.instantiate(m, imports)).then(done),
};
importScripts('chess.js');
onmessage = e => e.data instanceof WebAssembly.Module ? gotWasm(e.data) : ready ? uci(e.data) : queue.push(e.data);
