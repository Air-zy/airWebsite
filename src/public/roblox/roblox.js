// /roblox. the side bar under 600px, the chart, the videos, and the live numbers. one function so terser can
// shorten every name. home's js/main.js runs that page and nothing here, so the side bar bit is a copy of its own
(() => {
  const sideBar = document.getElementById('side-bar');
  const menuIcon = document.querySelector('.menu-icon');

  function setSidebar(open) {
    sideBar.classList.toggle('open', open);
    menuIcon.classList.toggle('active', open);
    menuIcon.setAttribute('aria-expanded', open);
  }
  menuIcon.addEventListener('click', () => setSidebar(!sideBar.classList.contains('open')));
  // its links are all on this page but home, so it closes on the way to one
  sideBar.addEventListener('click', e => { if (e.target.closest('a')) setSidebar(false); });

  // each gold number in the first screen opens or closes its note, the same as how i started on home
  for (const b of document.querySelectorAll('.why')) {
    b.addEventListener('click', () => {
      const note = document.getElementById(b.getAttribute('aria-controls'));
      note.hidden = !note.hidden;
      b.setAttribute('aria-expanded', !note.hidden);
    });
  }

  // the avatar comes alive: rowa2's own figure turning, drag to spin it, a tap for the next pose. it all runs in
  // roblox/figure.worker.js on a canvas handed to it, so the page never stalls, and the still stays up until the canvas
  // has a frame. the figure's files are saved on the site (roblox/figure/), about 0.5 MB the first time and cached after.
  // it starts once the page has loaded and gone quiet, except on data saver or a 2g connection, where it waits for a
  // press. a browser that can't do webgl in a worker (safari before 17) just keeps the still
  const fig = document.querySelector('.figure');
  function wake() {
    if (fig.dataset.state || !HTMLCanvasElement.prototype.transferControlToOffscreen) return;
    fig.dataset.state = 'loading';
    const c = document.createElement('canvas');
    fig.append(c);
    const off = c.transferControlToOffscreen();
    const worker = new Worker(fig.dataset.worker, { type: 'module' });
    const size = () => [c.clientWidth, c.clientHeight];
    const fail = why => {
      console.log('figure:', why);
      worker.terminate();
      c.remove();
      fig.dataset.state = 'off';
    };
    worker.onmessage = ({ data }) => {
      if (data.painted) fig.dataset.state = 'live';
      if (data.failed) fail(data.failed);
    };
    worker.onerror = e => fail(e.message);
    worker.postMessage({ start: {
      canvas: off, size: size(), dpr: devicePixelRatio,
      reduced: matchMedia('(prefers-reduced-motion: reduce)').matches,
      r6: new URL(fig.dataset.r6, location.href).href, rig: new URL(fig.dataset.rig, location.href).href,
      id: +fig.dataset.id, pose: +fig.dataset.pose, rim: fig.dataset.rim,
    } }, [off]);
    new ResizeObserver(() => worker.postMessage({ size: size(), dpr: devicePixelRatio })).observe(c);
    new IntersectionObserver(([e]) => worker.postMessage({ seen: e.isIntersecting })).observe(c);
    // the button takes the pointer and the canvas only draws, so a press that woke it isn't also a tap. a move only
    // matters during a drag
    const send = e => { if (fig.dataset.state === 'live') worker.postMessage({ pointer: e.type, x: e.clientX }); };
    fig.addEventListener('pointerdown', e => {
      if (fig.dataset.state !== 'live') return;
      fig.setPointerCapture(e.pointerId);
      send(e);
    });
    fig.addEventListener('pointermove', e => { if (e.buttons) send(e); });
    for (const type of ['pointerup', 'pointercancel']) fig.addEventListener(type, send);
  }
  fig.addEventListener('click', wake);
  const net = navigator.connection;
  if (!net?.saveData && !/2g/.test(net?.effectiveType || '')) {
    // safari has no requestIdleCallback
    const quiet = () => window.requestIdleCallback ? requestIdleCallback(wake, { timeout: 3000 }) : setTimeout(wake, 500);
    if (document.readyState === 'complete') quiet();
    else addEventListener('load', quiet, { once: true });
  }

  const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format;
  const full = new Intl.NumberFormat('en').format;

  // games i made each year, a column a year from the first to the last with any. the tallest is the gold one and the
  // only one with its number on it, hover or focus gives any year's. the table under it is the same numbers
  const chart = document.querySelector('.years');
  function drawYears(years) {
    const known = Object.keys(years).map(Number);
    const rows = [];
    for (let y = Math.min(...known); y <= Math.max(...known); y++) rows.push([y, years[y] || { games: 0, visits: 0 }]);
    const max = Math.max(...rows.map(([, r]) => r.games));
    const cols = chart.querySelector('.cols');
    cols.style.setProperty('--max', max);
    cols.replaceChildren(...rows.map(([year, r]) => {
      const li = document.createElement('li');
      li.tabIndex = 0;
      li.style.setProperty('--v', r.games);
      if (r.games === max) li.className = 'peak';
      // a year with none draws no bar at all, the 2px floor is for one game
      li.innerHTML = (r.games ? '<span class="bar"></span>' : '')
        + (r.games === max ? `<span class="val" aria-hidden="true">${r.games}</span>` : '')
        // the space keeps a screen reader from reading "201812 games"
        + `<span class="year">${year}</span> `
        + `<span class="tip">${r.games} game${r.games === 1 ? '' : 's'}, ${compact(r.visits)} visits</span>`;
      return li;
    }));
    chart.querySelector('tbody').replaceChildren(...rows.map(([year, r]) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${year}</td><td>${full(r.games)}</td><td>${full(r.visits)}</td>`;
      return tr;
    }));
  }
  drawYears(JSON.parse(chart.dataset.years));

  // a video's picture turns into its player on click. a click with a modifier still opens youtube in a tab
  for (const a of document.querySelectorAll('.video')) {
    a.addEventListener('click', e => {
      if (e.ctrlKey || e.metaKey || e.shiftKey || e.button) return;
      e.preventDefault();
      const box = document.createElement('div');
      box.className = 'video';
      const frame = Object.assign(document.createElement('iframe'), {
        src: `https://www.youtube-nocookie.com/embed/${a.dataset.yt}?autoplay=1`,
        title: a.querySelector('.v-title').textContent,
        allow: 'autoplay; encrypted-media; picture-in-picture; fullscreen',
        referrerPolicy: 'strict-origin-when-cross-origin',
      });
      frame.allowFullscreen = true;
      box.append(frame);
      a.replaceWith(box);
      frame.focus();
    });
  }

  // the page holds the numbers from the day it was written, so a failed fetch just leaves those. ?ids= asks for the
  // visits of the games listed here
  const ids = [...new Set([...document.querySelectorAll('[data-game]')].map(el => el.dataset.game))];
  fetch('/api/roblox-stats?ids=' + ids)
    .then(res => res.ok ? res.json() : Promise.reject(res.status))
    .then(r => {
      for (const el of document.querySelectorAll('[data-roblox]')) el.textContent = compact(r[el.dataset.roblox]);
      for (const el of document.querySelectorAll('[data-game]')) if (el.dataset.game in r.of) el.textContent = compact(r.of[el.dataset.game]);
      if (Object.keys(r.years).length) drawYears(r.years);
    })
    .catch(err => console.log('roblox stats:', err));
})();
