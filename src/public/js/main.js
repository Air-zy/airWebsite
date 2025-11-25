let defaultRootStyle;

const spanStyles = new Map();
document.querySelectorAll('span').forEach(span => {
  spanStyles.set(span, {
    c: span.style.color || '',
    s: span.style.textShadow || '',
    d: span.style.textDecoration || ''
  });
});

function updateSpansLmode() {
  const icon = document.getElementById('icon');
  const spans = document.querySelectorAll('span');

  if (icon.classList.contains('fa-moon-o')) {
    spans.forEach(span => {
      const originalStyles = spanStyles.get(span);
      if (originalStyles) {
      span.style.color = originalStyles.c;
      span.style.textShadow = originalStyles.s;
      span.style.textDecoration = originalStyles.d;
      }
    });
  } else {
    spans.forEach(span => {
      span.style.color = 'black';
      span.style.textShadow = 'none';
      span.style.textDecoration = 'underline';
    });
  }
}

const icons = document.querySelectorAll('.social-media-container .social-medias .fa');

icons.forEach((icon, index) => {
  icon.style.animationDelay = `${index * 0.1}s`;
});


function toggleLightMode() {
  const icon = document.getElementById('icon');
  const root = document.documentElement;
  
  if (icon.classList.contains('fa-moon-o')) {
    icon.classList.remove('fa-moon-o');
    icon.classList.add('fa-sun-o');

    root.style.setProperty('color-scheme', 'light');
    root.style.setProperty('--bg-col', '#ffffff');
    root.style.setProperty('--bg-rgb-full', 'rgb(255, 255, 255)');
    root.style.setProperty('--bg-rgb-half', 'rgb(226, 226, 226, 0.3)');
    root.style.setProperty('--text-grey', 'grey');
    root.style.setProperty('--text-normal', '#000000');
    root.style.setProperty('--frame-bcol', '#EFEFEF');
    root.style.setProperty('--frame-bcol2', '#e3e3e3');

  } else {
    icon.classList.remove('fa-sun-o');
    icon.classList.add('fa-moon-o');
    
    root.style.setProperty('color-scheme', defaultRootStyle.colorScheme);
    root.style.setProperty('--bg-col', defaultRootStyle.bgCol);
    root.style.setProperty('--bg-rgb-full', defaultRootStyle.bgRgbFull);
    root.style.setProperty('--bg-rgb-half', defaultRootStyle.bgRgbHalf);
    root.style.setProperty('--text-grey', defaultRootStyle.textGrey);
    root.style.setProperty('--text-normal', defaultRootStyle.textNormal);
    root.style.setProperty('--frame-bcol', defaultRootStyle.frameBcol);
    root.style.setProperty('--frame-bcol2', defaultRootStyle.frameBcol2);
    
  }
  updateSpansLmode();
}


function menuTrigger(menuIcon) {
  menuIcon.classList.toggle("active");

  const overlay = document.getElementById("side-bar");
  overlay.classList.toggle("open");

  localStorage.setItem("sidebarOpen", overlay.classList.contains("open"));
}

function updateSidebarState() {
  const overlay = document.getElementById("side-bar");
  if (localStorage.getItem("sidebarOpen") === "true") {
    overlay.classList.add("open");
    const menuIcon = document.querySelector(".menu-icon"); // replace with the actual selector
    if (menuIcon) {
      menuIcon.classList.add("active");
    }
  } else {
    overlay.classList.remove("open");
  }
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

/*toggleLightMode()*/
updateSidebarState();

document.addEventListener("DOMContentLoaded", function () {
  const name = document.getElementById("airzy");
  
  const targetText = "Airzy";
  const characters = "αβγδεζηθικλμνξοπρστυφχψωπ";
  let currentText = " ".repeat(5);
  name.innerText = currentText;

  let index = 0;
  let count = 0;
  
  const root = document.documentElement;
  defaultRootStyle = {
    colorScheme: getComputedStyle(root).getPropertyValue('color-scheme'),
    bgCol: getComputedStyle(root).getPropertyValue('--bg-col'),
    bgRgbFull: getComputedStyle(root).getPropertyValue('--bg-rgb-full'),
    bgRgbHalf: getComputedStyle(root).getPropertyValue('--bg-rgb-half'),
    textGrey: getComputedStyle(root).getPropertyValue('--text-grey'),
    textNormal: getComputedStyle(root).getPropertyValue('--text-normal'),
    frameBcol: getComputedStyle(root).getPropertyValue('--frame-bcol')
  };

  const interval = setInterval(() => {
    if (count < 2) {
      currentText =
        currentText.substring(0, index) +
        characters.charAt(Math.floor(Math.random() * characters.length)) +
        currentText.substring(index + 1);
      name.innerText = currentText;
      count++;
    } else {
      currentText =
        currentText.substring(0, index) +
        targetText.charAt(index) +
        currentText.substring(index + 1);
      name.innerText = currentText;
      index++;
      count = 0;
    }

    if (index >= targetText.length) {
      setTimeout(() => {
      name.classList.add("glow");
      handleSections()
      }, 400);
      clearInterval(interval);
    }
  }, 40);
});

function isInViewport(el) {
  const rect = el.getBoundingClientRect(); // TODO optimize this
  return (
    rect.top >= 0 &&
    rect.bottom-rect.height <= (window.innerHeight || document.documentElement.clientHeight)
  );
}

function handleSections() {
  const sections = document.querySelectorAll('.txt-section');
  sections.forEach(section => {
    if (isInViewport(section)) {
      section.classList.add('show');
    }
  });
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
    sortedProjects.forEach((proj, key) => setTimeout(() => {
      const cardContainer = document.createElement('div');
      cardContainer.classList.add('project-container');
      
      const card = document.createElement('a');
      card.href = proj.url;
      card.target = '_blank';
      card.classList.add('project-card');
      card.addEventListener('click', (event) => {
        try {
          fetch('/api/project-edit', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              type: "view",
              value: key
            })
          })
        } catch(err) {
          console.log("[ERROR] project view send", err);
        }
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

      const icon = document.createElement('i');
      icon.classList.add('fa', 'fa-eye');
      
      pStats.append(proj.stats.views + ' ');
      pStats.appendChild(icon);
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
      container.appendChild(cardContainer);
    }, index * 100)); 

  } catch (error) {
    let errorMessage = 'Failed to fetch projects: ' + String(error);
    const container = document.getElementById('projects');
    container.innerHTML = errorMessage;
    alert(errorMessage);
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
        updateSpansLmode()
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
        updateSpansLmode()
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
  
  if (scrollTop < 800) {
    nav.style.minHeight = `${100 - scrollTop / 8}px`;
  }
  //section1.style.top = `${140-scrollTop/6}px`
  section1.style.transform = `translateY(${(-scrollTop / 6)}px)`;

  
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
  
  if ((scrollHeight-scrollTop) < 2000 && canLoadContent) {
    //fetch('intro.html')
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
  
  if ((scrollHeight-scrollTop) < 200 && attemptedUserValidate == false) { attemptedUserValidate = true;
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
      //alert(error)
    });
    
  }
  
  handleSections()
  //console.log(`main scrollTop: ${scrollTop}px`);
});

/* main status */
function timeDifference(utcDateString) {
    const now = new Date();
    const past = new Date(utcDateString); // parse UTC or ISO string corectly

    let diff = now - past; // diff in ms

    const seconds = Math.floor(diff / 1000);
    if (seconds < 60) return `${seconds} second${seconds !== 1 ? 's' : ''} ago`;

    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;

    const days = Math.floor(hours / 24);
    if (days < 30) return `${days} day${days !== 1 ? 's' : ''} ago`;

    const months = Math.floor(days / 30); // anything under here im probabily dead :skull:
    if (months < 12) return `${months} month${months !== 1 ? 's' : ''} ago`;

    const years = Math.floor(months / 12);
    return `${years} year${years !== 1 ? 's' : ''} ago`;
}
function timeDifferenceSince(utcDateString) {
    const now = new Date();
    const past = new Date(utcDateString); // parse UTC or ISO string corectly

    let diff = now - past; // diff in ms

    const seconds = Math.floor(diff / 1000);
    if (seconds < 60) return `${seconds} second${seconds !== 1 ? 's' : ''}`;

    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''}`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''}`;

    const days = Math.floor(hours / 24);
    if (days < 30) return `${days} day${days !== 1 ? 's' : ''}`;

    const months = Math.floor(days / 30); // anything under here im probabily dead :skull:
    if (months < 12) return `${months} month${months !== 1 ? 's' : ''}`;

    const years = Math.floor(months / 12);
    return `${years} year${years !== 1 ? 's' : ''}`;
}

let currentStatus
let lastOnTimestamp
let statusSince

const mainStatusElm = document.getElementById("main-status");
const mainLastSeenElm = document.getElementById("main-last-seen");
const ws = new WebSocket('/ws');

ws.onopen = () => {
  console.log("WS connected");
};
ws.onclose = () => {
  console.log("WS closed");
};
ws.onerror = (err) => {
  console.error("WS error", err);
};

ws.onmessage = (msg) => {
  console.log("WS msg:", msg)
  const data = JSON.parse(msg.data);
  const dstatus = data.status
  if (dstatus == "offline") {
    mainStatusElm.innerText = `status: ${dstatus}`
    mainLastSeenElm.innerText = `last seen: ${timeDifference(data.lastOn)}`
  } else {
    mainLastSeenElm.innerText = `last updated: ${timeDifference(data.lastOn)}`
    if (dstatus == "online") {
      mainStatusElm.innerText = `status: 🟢 ${dstatus}`
    } else if (dstatus == "dnd") {
      mainStatusElm.innerText = `status: 🔴 ${dstatus}`
    } else if (dstatus == "idle") {
      mainStatusElm.innerText = `status: 🟡 ${dstatus}`
    }
  }
  mainStatusElm.innerText += ` for ${timeDifferenceSince(data.since)}`

  currentStatus = dstatus
  lastOnTimestamp = data.lastOn;
  statusSince = data.since
};

setInterval(() => {
  if (currentStatus && lastOnTimestamp) {
    if (currentStatus === "offline") {
      mainStatusElm.innerText = `status: ${currentStatus}`
      mainLastSeenElm.innerText = `last seen: ${timeDifference(lastOnTimestamp)}`;
    } else {
      mainLastSeenElm.innerText = `last updated: ${timeDifference(lastOnTimestamp)}`;
      if (currentStatus == "online") {
        mainStatusElm.innerText = `status: 🟢 ${currentStatus}`
      } else if (currentStatus == "dnd") {
        mainStatusElm.innerText = `status: 🔴 ${currentStatus}`
      } else if (currentStatus == "idle") {
        mainStatusElm.innerText = `status: 🟡 ${currentStatus}`
      }
    }
    mainStatusElm.innerText += ` for ${timeDifferenceSince(statusSince)}`
  }
}, 1000);

/* ---- */

function animateScroll(element, targetElm, duration) {
  const startTime = performance.now();

  function animate(time) {
      const elapsedTime = time - startTime;

      const progress = Math.min(elapsedTime / duration, 1);
      //const ease = easeOutQuad(progress);

      const rect = targetElm.getBoundingClientRect();
      const to = rect.top - rect.height/2 + 140;

      const start = element.scrollTop;
      const change = to //- start;
    
      element.scrollTop = start + change * 0.1;

      if (progress < 1 && Math.abs(to) > 2) {
          requestAnimationFrame(animate);
      //} else {
        
      }
  }

  requestAnimationFrame(animate);
}

function easeOutQuad(t) {
    return 1 - (1 - t) * (1 - t);
}

async function scrollTo(targetElm) {
  animateScroll(mainContentElm, targetElm, 1000);
}

// the navigation
async function toResources() {
  if (!projectsLoaded) {
    await loadProjects();
  }
  const targetElm = document.getElementById('projects');
  scrollTo(targetElm)
  
  const overlay = document.getElementById("side-bar");
  overlay.classList.remove("open");
}

async function toAirzy() {
  if (!introsLoaded) {
    await loadIntro();
  }
  const targetElm = document.getElementById('intro-section');
  scrollTo(targetElm)
  
  const overlay = document.getElementById("side-bar");
  overlay.classList.remove("open");
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
  }

  requestAnimationFrame(lerpColor);
  
  scrollTo(contactFrame)
  
  const overlay = document.getElementById("side-bar");
  overlay.classList.remove("open");
}

function openChat() {
  alert("il code this in later lmao")
}

if (window.location.pathname === '/') {
  window.history.replaceState(null, '', '/home');
}
