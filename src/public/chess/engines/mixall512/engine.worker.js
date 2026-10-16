// web worker around chess.js + chess.wasm (same folder). post uci commands in, get output lines back. 'ready' comes
// once the wasm has loaded; commands posted before that are queued
const queue = [], uci = cmd => Module.ccall('uci', null, ['string'], [cmd]);
let ready = false;
self.Module = { print: line => postMessage(line), postRun: [() => { ready = true; postMessage('ready'); queue.splice(0).forEach(uci); }] };
importScripts('chess.js');
onmessage = e => (ready ? uci(e.data) : queue.push(e.data));
