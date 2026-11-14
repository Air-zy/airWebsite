// /roblox's live avatar. rowa2's own turntable (ROWA/r6.js) runs in here, so building the figure and drawing its first
// frame, which is most of a second of compiling shaders, happen off the page's main thread and the page never stalls
// on them. the page hands over its canvas, then sends the canvas size, whether it's on screen and the pointer. these
// stand in for the dom pieces turntable reads
let size = [0, 0], reduced = false, painted = false, canvas;
const resized = new Set(), watched = new Set();

self.devicePixelRatio = 1;
self.matchMedia = () => ({ matches: reduced });
self.ResizeObserver = class {
  constructor(fn) { this.fn = fn; }
  observe() { resized.add(this.fn); if (size[0]) this.fn([]); }
  disconnect() { resized.delete(this.fn); }
};
self.IntersectionObserver = class {
  constructor(fn) { this.fn = fn; }
  observe() { watched.add(this.fn); }
  disconnect() { watched.delete(this.fn); }
};

// the page keeps its still up until a frame is on the canvas. turning on its own it draws at most 30 frames a second,
// half the gpu, and a turn every 25s still looks smooth. a drag or the pose change after a tap gets every frame,
// turntable times its moves off the clock so the speed is the same either way
const raf = self.requestAnimationFrame.bind(self);
let last = 0, busyUntil = 0;
self.requestAnimationFrame = fn => raf(function tick(t) {
  if (t < busyUntil || t - last > 30) {
    last = t;
    fn(t);
  } else return raf(tick);
  if (!painted) {
    painted = true;
    postMessage({ painted: true });
  }
});

onmessage = async ({ data }) => {
  if (data.start) {
    const s = data.start;
    ({ canvas, reduced, size } = s);
    self.devicePixelRatio = s.dpr;
    Object.defineProperties(canvas, { clientWidth: { get: () => size[0] }, clientHeight: { get: () => size[1] } });
    canvas.setPointerCapture = () => {};
    try {
      const r6 = await import(s.r6);
      // the recipe and every file it names are on the site, not the rig route
      r6.rigs[s.id] = s.rig;
      await r6.turntable(s.id, canvas, s.rim, s.pose);
    } catch (err) {
      postMessage({ failed: err.message });
    }
  } else if (data.size) {
    size = data.size;
    self.devicePixelRatio = data.dpr;
    for (const fn of resized) fn([]);
  } else if ('seen' in data) {
    for (const fn of watched) fn([{ isIntersecting: data.seen }]);
  } else if (data.pointer && canvas) {
    // what turntable reads off a pointer event. timeStamp is when the event is made, here, close enough to when it
    // happened on the page
    const e = new Event(data.pointer, { cancelable: true });
    Object.defineProperties(e, { clientX: { value: data.x }, pointerId: { value: 1 } });
    // full rate from the press until the pose change (360ms) after it lets go
    if (data.pointer === 'pointerdown') busyUntil = Infinity;
    else if (data.pointer !== 'pointermove') busyUntil = performance.now() + 600;
    canvas.dispatchEvent(e);
  }
};
