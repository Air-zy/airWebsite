const icons = document.querySelectorAll('.social-media-container .social-medias .fa');

icons.forEach((icon, index) => {
  icon.style.animationDelay = `${index * 0.1}s`;
});


// colors live in main.css under :root[data-theme=light], this only flips the switch
function applyTheme(light) {
  document.documentElement.setAttribute('data-theme', light ? 'light' : 'dark');
  document.querySelector('#icon use').setAttribute('href', light ? '#i-sun-o' : '#i-moon-o');
}

function toggleLightMode() {
  const light = document.documentElement.getAttribute('data-theme') !== 'light';
  applyTheme(light);
  localStorage.setItem('lightMode', light);
}

applyTheme(localStorage.getItem('lightMode') === 'true');


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

document.addEventListener("DOMContentLoaded", function () {
  const name = document.getElementById("airzy");

  // the letter sits behind the box from the start, so nothing reflows as it resolves
  const cells = [..."Airzy"].map((ch) => {
    const cell = document.createElement("span");
    cell.className = "cell block";
    cell.textContent = ch;
    name.appendChild(cell);
    return cell;
  });

  const FLASHES = 3;
  let index = 0;
  let flashes = 0;

  const interval = setInterval(() => {
    cells[index].classList.toggle("block");

    if (++flashes < FLASHES) return;

    cells[index].classList.remove("block");
    flashes = 0;
    index++;

    if (index >= cells.length) {
      name.classList.add("glow");
      setTimeout(handleSections, 400);
      clearInterval(interval);
    }
  }, 40);
});

// reveal once the top edge crosses the line, no lower bound so a jump past a section still reveals it.
// shown and hidden sections drop out of the query, a hidden one measures top 0 and would count as seen
function handleSections() {
  const pending = document.querySelectorAll('.txt-section:not(.show):not([hidden])');
  if (!pending.length) return; // every scroll after the last reveal costs nothing
  const line = document.getElementById('main-content').clientHeight * 0.9;
  pending.forEach(section => {
    if (section.getBoundingClientRect().top < line) section.classList.add('show');
  });
}

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
    img.height = img.width = window.innerWidth <= 600 ? 100 : 200;
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

  const textContainer = document.createElement(window.innerWidth <= 600 ? 'details' : 'div');
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
    if (!res.ok) throw new Error('Failed to fetch data');
    const rank = ([, proj]) => proj.stats.views / proj.rank;
    container.replaceChildren(...Object.entries(await res.json())
      .sort((a, b) => rank(b) - rank(a))
      .map(([key, proj]) => makeProjectCard(proj, key)));
  } catch (error) {
    // textContent, a json parse error quotes the html it choked on and innerHTML would try to render it
    container.textContent = 'Failed to fetch projects: ' + String(error);
  }
}

// projects.html and intro.html get appended to the article when needed. the promise is kept so every
// caller shares one fetch, and dropped on failure so the next call retries
const partials = {};
function loadPartial(file, then) {
  return partials[file] ??= fetch(file)
    .then(res => res.ok ? res.text() : Promise.reject(new Error(`${file} ${res.status}`)))
    .then(html => {
      document.querySelector('#main-content article').insertAdjacentHTML('beforeend', html);
      handleSections();
      then?.();
    })
    .catch(err => {
      delete partials[file];
      console.error(err);
    });
}
const loadProjects = () => loadPartial('projects.html', reloadProjects);
const loadIntro = () => loadPartial('intro.html');

const pageStart = Date.now();

let attemptedUserValidate = false;
let canLoadContent = true;
const mainContentElm = document.getElementById("main-content");
mainContentElm.addEventListener("scroll", function () {
  const scrollTop = this.scrollTop;
  const scrollHeight = this.scrollHeight - this.clientHeight;

  const nav = document.getElementsByTagName("nav")[0];
  const section1 = document.getElementById("s1");
  section1.style.transform = `translateY(${(-scrollTop / 6)}px)`;

  if (scrollTop < 800) {
    nav.style.minHeight = `${100 - scrollTop / 8}px`;
  }


  const adapt = document.getElementById("adapt");
  if (scrollTop > 700 && scrollTop < 740 && adapt.innerText == "develop") {
    let t = 0
    const interval = setInterval(() => {
      t += 0.2
      adapt.innerText = lerpString("grow", "ADAPT", t)
      if (t > 2 || adapt.innerText == "ADAPT") {
        clearInterval(interval);
      }
    }, 80);
  }

  if ((scrollHeight - scrollTop) < 2000 && canLoadContent) {
    if (!partials['projects.html']) loadProjects();
    else loadIntro();
    canLoadContent = false;
    setTimeout(() => {
      canLoadContent = true;
    }, 500);
  }

  if ((scrollHeight - scrollTop) < 200 && attemptedUserValidate == false) {
    attemptedUserValidate = true;
    fetch('/validate-me', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionDuration: Date.now() - pageStart }),
    }).then(response => response.json())
      .then(data => {
        if (data.message) {
          document.getElementById("main-email").innerHTML = `<a href="mailto:${data.message}" style="text-decoration:none">${data.message}</a>`;
        } else {
          console.log("user validate err", data)
        }
        if (!data.valid) return;
        // the text after each icon
        const discord = document.getElementById("main-discord");
        discord.href = data.cord;
        discord.lastChild.textContent = ` "${data.cordN}" on Discord`;
        document.getElementById("main-location").lastChild.textContent = ` ${data.loc}`;
      }).catch(error => {
        const mainEmailP = document.getElementById("main-email")
        mainEmailP.textContent = "failed to validate human"
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
      })
  }

  handleSections()
});

async function toResources() {
  await loadProjects();
  document.getElementById('projects').scrollIntoView({ block: 'center' });
  setSidebar(false);
}

async function toAirzy() {
  await loadIntro();
  document.getElementById('intro-section').scrollIntoView({ block: 'center' });
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

// the owner's pin and delete. the server checks ADMIN_UID on both, this only decides who sees them
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
  if (admin) {
    caption.append(' ',
      noteButton(pinned ? 'unpin' : 'pin', async () => {
        if ((await fetch(`/api/notes/${id}/pin`, { method: 'POST' })).ok) loadGuestbook(); // reload for the new order
      }),
      noteButton('delete', async () => {
        if ((await fetch(`/api/notes/${id}`, { method: 'DELETE' })).ok) note.remove();
      }),
    );
  }
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
  // blank paper while it loads and notes landing after, only the first time. a reload after pinning just swaps
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
    // anyone can write, signing in waits until they send. shown after the board so a sent note cant land before it
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

// hidden until Leave A Note, so a visit that never clicks never wakes the database.
// projects and intro land above it, load them first or it moves out from under the scroll
async function toGuestbook() {
  const guestbook = document.getElementById('guestbook');
  if (guestbook.hidden) {
    guestbook.hidden = false;
    loadGuestbook();
  }
  await loadProjects();
  await loadIntro();
  // offsetTop ignores the slide in transform, so it lands the same revealed or not. 100 clears the nav
  mainContentElm.scrollTo({ top: guestbook.offsetTop - 100 });
  setSidebar(false);
}

// signing needs an account. the popup logs you in without leaving the page, then the note goes out
const loginDialog = document.getElementById('login-dialog');
const loginFrame = loginDialog.querySelector('iframe');

function askLogin() {
  // set on every open so it starts fresh, and nothing loads for visitors who never sign
  loginFrame.src = '/auth/?next=%2Fhome%23guestbook';
  loginDialog.showModal();
}

// closing the dialog does not stop the page inside, chrome kept animating its dither. unload it instead
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

// the address bar follows the guestbook so a refresh or a shared link lands back on it.
// a line a third of the way down counts, a board taller than the screen still crosses it
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
  window.history.replaceState(null, '', '/home');
}
