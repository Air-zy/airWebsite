const sideBar = document.getElementById('side-bar');
const menuIcon = document.querySelector('.menu-icon');

// every open and close goes through here so the icon and aria never drift from the sidebar
function setSidebar(open) {
  sideBar.classList.toggle('open', open);
  menuIcon.classList.toggle('active', open);
  menuIcon.setAttribute('aria-expanded', open);
}

function menuTrigger() {
  setSidebar(!sideBar.classList.contains('open'));
}

// the first t share of final, then the rest of initial
function lerpString(initial, final, t) {
  const n = Math.floor(Math.max(0, Math.min(1, t)) * final.length);
  return final.slice(0, n) + initial.slice(n);
}

// the plant growing in is the one moment on the first screen, the bubble on the name pops once it has grown,
// or right away when there is no plant
const popBubble = () => document.getElementById('s1').classList.add('done');

// a new nonflowers plant every visit, ?seed= brings one back. js/flower/worker.js paints it off the main thread
// and main.css grows it in. no worker or OffscreenCanvas and it just stays hidden
(function growFlower() {
  const fig = document.querySelector('.flower');
  if (!window.Worker || !window.OffscreenCanvas) return popBubble();
  // digits only, nonflowers hashes the seed and a long one overflows to NaN and draws nothing
  const asked = new URLSearchParams(location.search).get('seed');
  const seed = /^\d{1,9}$/.test(asked) ? asked : String(Math.floor(Math.random() * 1e9));

  fig.hidden = false;
  const worker = new Worker('js/flower/worker.js');
  const fail = err => { worker.terminate(); fig.hidden = true; popBubble(); console.error('flower:', err); };
  worker.onerror = e => fail(e.message);
  worker.onmessage = ({ data }) => {
    worker.terminate();
    if (data.error) return fail(data.error);
    const canvas = fig.querySelector('canvas');
    canvas.width = data.bitmap.width;
    canvas.height = data.bitmap.height;
    canvas.getContext('2d').drawImage(data.bitmap, 0, 0);
    fig.classList.add('grown');
    // reduced motion turns the grow off, then there is no animationend to wait for
    if (getComputedStyle(canvas).animationName === 'none') popBubble();
    else canvas.addEventListener('animationend', popBubble, { once: true });
  };
  worker.postMessage({ seed });
})();

function requestViewsUpdate(key) {
  fetch('/api/projects/edit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'view', value: key }),
  }).catch(err => console.log('[ERROR] project view send', err));
}

function makeProjectCard(proj, key) {
  const cardContainer = document.createElement('div');
  cardContainer.classList.add('project-container');

  const card = document.createElement('a');
  card.href = proj.url;
  card.target = '_blank';
  card.classList.add('project-card');
  card.addEventListener('click', () => requestViewsUpdate(key));

  if (proj.img) {
    const img = document.createElement('img');
    img.src = proj.img;
    img.alt = proj.alt;
    card.appendChild(img);
  }

  const pTitle = document.createElement('p');
  pTitle.textContent = proj.title;
  pTitle.classList.add('proj-title');
  card.appendChild(pTitle);

  const pStats = document.createElement('p');
  pStats.classList.add('proj-stats');

  pStats.append(proj.stats.views + ' ');
  pStats.insertAdjacentHTML('beforeend', '<svg class="icon"><use href="#i-eye"/></svg>');
  card.appendChild(pStats);

  const textContainer = document.createElement('div');
  proj.text.forEach(line => {
    const p = document.createElement('p');
    // [link text]("url") turns into a link
    p.innerHTML = line.replace(/\[([^\]]+)\]\("([^"]+)"\)/g, '<a href="$2" target="_blank">$1</a>');
    textContainer.appendChild(p);
  });

  card.appendChild(textContainer);

  const footer = document.createElement('div');
  footer.classList.add('project-footer');

  proj.tags.forEach(tag => {
    const p = document.createElement('p');
    p.textContent = tag;
    footer.appendChild(p);
  });

  cardContainer.appendChild(card)
  cardContainer.appendChild(footer)
  return cardContainer;
}

async function reloadProjects() {
  const container = document.getElementById('projects');
  try {
    const res = await fetch('/api/projects');
    if (!res.ok) throw new Error(`/api/projects ${res.status}`);
    const rank = ([, proj]) => proj.stats.views / proj.rank;
    container.replaceChildren(...Object.entries(await res.json())
      .sort((a, b) => rank(b) - rank(a))
      .map(([key, proj]) => makeProjectCard(proj, key)));
  } catch (error) {
    // what went wrong goes to the console, the visitor gets what to do about it
    console.error('projects:', error);
    container.textContent = "couldn't load the projects, try again in a bit";
  }
}

reloadProjects();

const pageStart = Date.now();
const mainContentElm = document.getElementById("main-content");

// once, when a thing first scrolls into view
function onSeen(el, fn) {
  new IntersectionObserver(([entry], io) => {
    if (!entry.isIntersecting) return;
    io.disconnect();
    fn();
  }, { root: mainContentElm }).observe(el);
}

onSeen(document.getElementById("adapt"), () => {
  const adapt = document.getElementById("adapt");
  let t = 0
  const interval = setInterval(() => {
    t += 0.2
    adapt.innerText = lerpString("grow", "ADAPT", t)
    if (t > 2 || adapt.innerText == "ADAPT") {
      clearInterval(interval);
    }
  }, 80);
});

// each number in how i started opens or closes its note
for (const b of document.querySelectorAll(".why")) {
  b.addEventListener("click", () => {
    const note = document.getElementById(b.getAttribute("aria-controls"));
    note.hidden = !note.hidden;
    b.setAttribute("aria-expanded", !note.hidden);
  });
}

// the live roblox numbers in how i started. the page already holds the last numbers i checked, so a failed fetch
// just leaves those
onSeen(document.getElementById("intro-section"), async () => {
  try {
    const res = await fetch("/api/roblox-stats");
    if (!res.ok) return;
    const r = await res.json();
    const n = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format;
    for (const el of document.querySelectorAll("[data-roblox]")) el.textContent = n(r[el.dataset.roblox]);
  } catch {}
});

// the contact rows stay hidden until this answers, the server wants half a second on the page first
onSeen(document.querySelector(".main-footer"), () => {
  const email = document.getElementById("main-email");
  fetch('/validate-me', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionDuration: Date.now() - pageStart }),
  }).then(response => response.json())
    .then(data => {
      // a failed check comes back with a message too, only a passed one carries the address
      if (!data.valid) throw new Error(data.message);
      const mail = document.createElement('a');
      mail.href = `mailto:${data.message}`;
      mail.textContent = data.message;
      email.replaceChildren(mail);
      email.hidden = false;
      // the text after each icon
      const discord = document.getElementById("main-discord");
      discord.href = data.cord;
      discord.append(` "${data.cordN}" on Discord`);
      discord.hidden = false;
      const loc = document.getElementById("main-location");
      loc.append(` ${data.loc}`);
      loc.hidden = false;
    }).catch(error => {
      email.textContent = "couldn't load my email, try refreshing";
      email.hidden = false;
      console.log("user validate:", error);
    });

  fetch('/api/status/lastOnline').then(response => response.json())
    .then(data => {
      const mainLastOnline = document.getElementById("main-last-on");
      mainLastOnline.innerText = `last online: ${data.minsAgo} mins ago`;

      if (data.backIn == null) return;
      const backIn = document.getElementById("main-back-in");
      backIn.innerText = data.backIn ? `expected back in about ~${data.backIn}h` : "probably active within the hour";
      backIn.hidden = false;
    }).catch(error => {
      document.getElementById("main-last-on").innerText = "couldn't check right now";
      console.log("last online:", error);
    });
});

function goTo(id) {
  document.getElementById(id).scrollIntoView();
  setSidebar(false);
}

function toContact() {
  const contactFrame = document.getElementById('contact-frame');
  // flashes grey and fades out so you see where it landed
  contactFrame.animate({ backgroundColor: ['rgb(128, 128, 128)', 'transparent'] }, 1000);
  contactFrame.scrollIntoView({ block: 'center' });
  setSidebar(false);
}

// the guestbook. notes are public and anyone can type html into one,
// so their text only ever goes in through textContent
const board = document.getElementById('board');
const boardForm = document.getElementById('board-form');
const boardStatus = document.getElementById('board-status');

// pin is admin only, delete is admin or whoever wrote it. the server checks both, this only decides who sees them
function noteButton(label, onclick) {
  const button = document.createElement('button');
  button.className = 'note-btn';
  button.textContent = label;
  button.onclick = onclick;
  return button;
}

function makeNote({ id, name, text, mine, pinned }, admin) {
  const note = document.createElement('figure');
  note.className = pinned ? 'note pinned' : 'note';
  const caption = document.createElement('figcaption');
  caption.textContent = mine ? 'you' : name;
  const sticky = document.createElement('p');
  sticky.className = `sticky paper-${id % 4}`;
  // colour and tilt come from the id so a note looks the same every visit
  sticky.style.setProperty('--tilt', `${((id * 7) % 5 - 2) * 1.2}deg`);
  sticky.textContent = text;
  // ascii art is several lines lined up with spaces. past 80 columns it is more likely prose, let that wrap
  const cols = Math.max(...text.split('\n').map(l => l.length));
  if (text.includes('\n') && /^ | {2}/m.test(text) && cols <= 80) {
    sticky.classList.add('art');
    sticky.style.setProperty('--cols', cols);
  }
  const buttons = [];
  if (admin) buttons.push(noteButton(pinned ? 'unpin' : 'pin', async () => {
    if ((await fetch(`/api/notes/${id}/pin`, { method: 'POST' })).ok) loadGuestbook(); // reload for the new order
  }));
  if (admin || mine) buttons.push(noteButton('delete', async () => {
    if ((await fetch(`/api/notes/${id}`, { method: 'DELETE' })).ok) note.remove();
  }));
  if (buttons.length) caption.append(' ', ...buttons);
  note.append(caption, sticky);
  return note;
}

function boardMessage(text) {
  const p = document.createElement('p');
  p.className = 'small-p';
  p.textContent = text;
  board.replaceChildren(p);
}

// one after another, capped so a full board of 50 is not still landing seconds later
function stagger(note, i, className) {
  note.classList.add(className);
  note.style.animationDelay = `${Math.min(i, 20) * 60}ms`;
  return note;
}

async function loadGuestbook() {
  // blank paper and landing notes on the first load only, a reload after pinning just swaps
  const first = !board.firstElementChild;
  if (first) board.replaceChildren(...[0, 1, 2, 3].map(i => stagger(makeNote({ id: i, name: '', text: '' }), i, 'blank')));
  board.ariaBusy = true;
  try {
    const res = await fetch('/api/notes');
    if (!res.ok) throw new Error(res.status);
    const { notes, admin } = await res.json();
    if (!notes.length) boardMessage('nothing here yet, be the first');
    else board.replaceChildren(...notes.map((n, i) => {
      const note = makeNote(n, admin);
      return first ? stagger(note, i, 'place') : note;
    }));
    // anyone can write, login waits for send. shown after the board so a sent note cant land before it
    boardForm.hidden = false;
    if (waitingNote) {
      boardForm.elements.text.value = waitingNote;
      waitingNote = null;
      boardForm.requestSubmit();
    }
  } catch {
    boardMessage("couldn't load the guestbook, try again in a bit");
  } finally {
    board.ariaBusy = false;
  }
}

// hidden until leave a note, so a visit that never clicks never wakes the database
function toGuestbook() {
  const guestbook = document.getElementById('guestbook');
  if (guestbook.hidden) {
    guestbook.hidden = false;
    loadGuestbook();
  }
  guestbook.scrollIntoView();
  setSidebar(false);
}

// signing needs an account. the popup logs you in without leaving the page, then the note goes out
const loginDialog = document.getElementById('login-dialog');
const loginFrame = loginDialog.querySelector('iframe');

function askLogin() {
  // loaded on open so visitors who never sign load nothing
  loginFrame.src = '/auth/?next=%2Fhome%23guestbook';
  loginDialog.showModal();
}

// a closed dialog keeps the page inside running, so unload it
loginDialog.addEventListener('close', () => { loginFrame.src = 'about:blank'; });

// the auth page posts this in place of redirecting when it is in the popup
addEventListener('message', e => {
  if (e.origin !== location.origin || e.source !== loginFrame.contentWindow || e.data !== 'signed-in') return;
  loginDialog.close();
  boardForm.requestSubmit();
});

// google refuses to be framed so it takes the whole tab, the note waits here until it lands back
addEventListener('pagehide', () => {
  if (loginDialog.open) sessionStorage.setItem('note', boardForm.elements.text.value);
});
let waitingNote = null;
try {
  waitingNote = sessionStorage.getItem('note');
  sessionStorage.removeItem('note');
} catch {} // storage can be blocked, the note is lost then

// google comes back to /home#guestbook
if (location.hash === '#guestbook') toGuestbook();

// the address bar follows the guestbook so a refresh or shared link lands back on it.
// a line a third down counts, so a board taller than the screen still crosses it
new IntersectionObserver(([entry]) => {
  history.replaceState(null, '', entry.isIntersecting ? '#guestbook' : location.pathname + location.search);
}, { root: mainContentElm, rootMargin: '-33% 0px -67% 0px' }).observe(document.getElementById('guestbook'));

boardForm.addEventListener('submit', async e => {
  e.preventDefault();
  const send = boardForm.querySelector('button');
  send.disabled = true;
  boardStatus.textContent = '';

  const res = await fetch('/api/notes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(Object.fromEntries(new FormData(boardForm))),
  }).catch(() => null);
  const data = res && await res.json().catch(() => ({}));
  send.disabled = false;

  if (res?.status === 401) return askLogin();
  if (!res?.ok) {
    boardStatus.textContent = res?.status === 429 ? 'slow down, try again in a few minutes' : data?.error || "couldn't sign, try again";
    return;
  }
  boardForm.elements.text.value = '';
  boardForm.elements.text.style.height = '';
  const note = makeNote(data.note);
  note.classList.add('place');
  if (!board.querySelector('.note')) board.replaceChildren(); // drops the "nothing here yet" line
  board.insertBefore(note, board.querySelector('.note:not(.pinned)')); // newest, under the pinned ones
});

// one line until you write more, then it grows with the text. max-height in the css caps it
boardForm.elements.text.addEventListener('input', e => {
  e.target.style.height = 'auto';
  e.target.style.height = `${e.target.scrollHeight}px`;
});

if (window.location.pathname === '/') {
  window.history.replaceState(null, '', '/home' + location.search + location.hash);
}
