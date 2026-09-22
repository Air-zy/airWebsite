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

function lerpString(initial, final, t) {
  t = Math.max(0, Math.min(1, t));
  const numCharsFromFinal = Math.floor(t * final.length);
  let result = '';
  for (let i = 0; i < Math.max(initial.length, final.length); i++) {
    if (i < numCharsFromFinal) {
      result += final[i] || '';
    } else {
      result += initial[i] || '';
    }
  }

  return result;
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
      setTimeout(() => {
        name.classList.add("glow");
        handleSections();
      }, 400);
      clearInterval(interval);
    }
  }, 40);
});

// reveal once the top edge crosses the line. no lower bound on purpose: a jump that
// lands past a section still reveals it instead of leaving it blank forever.
// the :not(.show) means this shrinks to an empty list once everything is up
function handleSections() {
  const pending = document.querySelectorAll('.txt-section:not(.show)');
  if (!pending.length) return; // every scroll after the last reveal costs nothing
  const line = document.getElementById('main-content').clientHeight * 0.9;
  pending.forEach(section => {
    if (section.getBoundingClientRect().top < line) section.classList.add('show');
  });
}

async function requestViewsUpdate(key) {
  try {
    fetch('/api/projects/edit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: "view",
        value: key
      })
    })
  } catch (err) {
    console.log("[ERROR] project view send", err);
  }
}

async function makeProjectCard(proj, key) {
  const cardContainer = document.createElement('div');
  cardContainer.classList.add('project-container');

  const card = document.createElement('a');
  card.href = proj.url;
  card.target = '_blank';
  card.classList.add('project-card');
  card.addEventListener('click', (event) => {
    requestViewsUpdate(key)
  })

  if (proj.img) {
    const img = document.createElement('img');
    img.src = proj.img;
    img.alt = proj.alt;
    if (window.innerWidth <= 600) {
      img.width = 100;
      img.height = 100;
    } else {
      img.width = 200;
      img.height = 200;
    }
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

  let textContainer
  if (window.innerWidth <= 600) {
    textContainer = document.createElement('details');
  } else {
    textContainer = document.createElement('div');
  }

  proj.text.forEach(line => {
    const p = document.createElement('p');

    // regex for [link text]("url")
    const regex = /\[([^\]]+)\]\("([^"]+)"\)/g;
    let modifiedLine = line;

    // replace with nchor
    modifiedLine = modifiedLine.replace(regex, (match, linkText, url) => {
      return `<a href="${url}" target="_blank">${linkText}</a>`;
    });

    p.innerHTML = modifiedLine;
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
  try {
    const projectsFetch = await fetch('/api/projects');
    if (!projectsFetch.ok) {
      throw new Error('Failed to fetch data');
    }

    const projects = await projectsFetch.json();
    const projectsMap = new Map(Object.entries(projects));

    function rankProj(proj) {
      return proj[1].stats.views / proj[1].rank;
    }

    const sortedProjects = new Map([...projectsMap.entries()].sort((a, b) => {
      return rankProj(b) - rankProj(a);
    }));

    const container = document.getElementById('projects');
    container.innerHTML = '';

    let index = 0;
    sortedProjects.forEach((proj, key) => setTimeout(async () => {
      const cardContainer = await makeProjectCard(proj, key);
      console.log(cardContainer)
      container.appendChild(cardContainer);
    }, index * 100));

  } catch (error) {
    // textContent, a json parse error quotes the html it choked on and innerHTML would try to render it
    document.getElementById('projects').textContent = 'Failed to fetch projects: ' + String(error);
  }
}

let projectsLoaded = false;
async function loadProjects() {
  if (projectsLoaded) {
    return;
  }
  projectsLoaded = true;
  await fetch('projects.html')
    .then(response => {
      if (response.ok) {
        return response.text();
      } else {
        console.log(response)
        projectsLoaded = false
      }
    }).then(htmlContent => {
      document.querySelector('#main-content article').insertAdjacentHTML('beforeend', htmlContent);
      handleSections()
    }).catch(error => {
      projectsLoaded = false;
      console.error('Error:', error);
    });

  reloadProjects()
}

let introsLoaded = false
async function loadIntro() {
  if (introsLoaded) {
    return;
  }
  introsLoaded = true;
  await fetch('intro.html')
    .then(response => {
      if (response.ok) {
        return response.text();
      } else {
        console.log(response)
        introsLoaded = false
      }
    }).then(htmlContent => {
      document.querySelector('#main-content article').insertAdjacentHTML('beforeend', htmlContent);
      handleSections()
    }).catch(error => {
      introsLoaded = false;
      console.error('Error:', error);
    });
}

const userBehavior = {
  startTime: Date.now(),
};

let attemptedUserValidate = false;
let canLoadContent = true;
const mainContentElm = document.getElementById("main-content");
mainContentElm.addEventListener("scroll", function () {
  const main = this;
  const scrollTop = main.scrollTop; // scroll position from top
  const scrollHeight = main.scrollHeight - main.clientHeight; // total scrollable height

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
    if (!projectsLoaded) {
      console.log("LOAD")
      loadProjects()
    } else if (!introsLoaded) {
      loadIntro()
    }
    canLoadContent = false;
    setTimeout(() => {
      canLoadContent = true;
    }, 500);
  }

  if ((scrollHeight - scrollTop) < 200 && attemptedUserValidate == false) {
    attemptedUserValidate = true;
    const payload = {
      sessionDuration: Date.now() - userBehavior.startTime,
    };

    fetch('/validate-me', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    }).then(response => response.json())
      .then(data => {
        const mainEmailP = document.getElementById("main-email")
        const mainDiscP = document.getElementById("main-discord")
        const mainLocP = document.getElementById("main-location")
        if (data && data.valid) {
          mainEmailP.innerHTML = `
          <a href="mailto:${data.message}" style="text-decoration:none">
            ${data.message}
          </a>
        `;
          mainDiscP.href = data.cord;

          mainDiscP.childNodes.forEach(node => {
            if (node.nodeType === Node.TEXT_NODE) {
              node.textContent = ` "${data.cordN}" on Discord`;
            }
          });
          mainLocP.childNodes.forEach(node => {
            if (node.nodeType === Node.TEXT_NODE) {
              node.textContent = ` ${data.loc}`;
            }
          });
        } else if (data.message) {
          mainEmailP.innerHTML = `
          <a href="mailto:${data.message}" style="text-decoration:none">
            ${data.message}
          </a>
        `;
        } else {
          console.log("user validate err", data)
        }
      }).catch(error => {
        const mainEmailP = document.getElementById("main-email")
        mainEmailP.textContent = "failed to validate human"
        console.log("user validate:", error);
      });

    fetch('/api/status/lastOnline').then(response => response.json())
      .then(data => {
        const mainLastOnline = document.getElementById("main-last-on");
        mainLastOnline.innerText = `last online: ${data.minsAgo} mins ago`;
      })
  }

  handleSections()
});

/* ---- */

// the navigation
async function toResources() {
  if (!projectsLoaded) {
    await loadProjects();
  }
  document.getElementById('projects').scrollIntoView({ block: 'center' });
  setSidebar(false);
}

async function toAirzy() {
  if (!introsLoaded) {
    await loadIntro();
  }
  document.getElementById('intro-section').scrollIntoView({ block: 'center' });
  setSidebar(false);
}

async function toContact() {
  const contactFrame = document.getElementById('contact-frame')

  let startTime = null;

  function lerpColor(timestamp) {
    if (!startTime) startTime = timestamp;
    const progress = Math.min((timestamp - startTime) / 1000, 1);
    const greyValue = 128 * (1 - progress);
    contactFrame.style.backgroundColor = `rgb(${greyValue}, ${greyValue}, ${greyValue})`;
    if (progress < 1) requestAnimationFrame(lerpColor);
    else contactFrame.style.backgroundColor = '';
  }

  requestAnimationFrame(lerpColor);

  contactFrame.scrollIntoView({ block: 'center' });
  setSidebar(false);
}

function openChat() {
  alert("il code this in later lmao")
}

if (window.location.pathname === '/') {
  window.history.replaceState(null, '', '/home');
}
