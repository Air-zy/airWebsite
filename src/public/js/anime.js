const mainAPIURL = "https://api.jikan.moe/v4"
const speedMS = 800

async function myCustomGet(baseUrl, params = {}) {
  const queryString = Object.entries(params)
    .map(
      ([key, value]) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(value)}`
    )
    .join("&");

  const url = `${baseUrl}?${queryString}`;

  const response = await fetch(url, { method: "GET" });

  if (!response.ok) {
    throw new Error(`HTTP error! Status: ${response.status}`);
  }

  return await response.json();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function seededRandom(seed) {
  var x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function getAnimeName(anime) {
  if (anime.title_english) {
    return anime.title_english;
  } else {
    return anime.title;
  }
}

function blendColors(color1, color2, weight = 0.5) {
  const d2h = (d) => d.toString(16).padStart(2, '0'); // decimal to hex
  const h2d = (h) => parseInt(h, 16); // hex to decimal

  const blended = '#' + [0, 2, 4].map((i) =>
    d2h(Math.round(h2d(color1.substr(i + 1, 2)) * (1 - weight) + h2d(color2.substr(i + 1, 2)) * weight))
  ).join('');
  
  return blended;
}

function getAnimeColor(anime) {
  const hasRom = anime.genres.some(genre => genre.name === 'Romance');
  const hasMys = anime.genres.some(genre => genre.name === 'Mystery');
  const hasDra = anime.genres.some(genre => genre.name === 'Drama');
  const hasAct = anime.genres.some(genre => genre.name === 'Action');
  const hasSpt = anime.genres.some(genre => genre.name === 'Sports');
  const hasCom = anime.genres.some(genre => genre.name === 'Comedy');
  const hasSOL = anime.genres.some(genre => genre.name === 'Slice of Life');
  const hasSus = anime.genres.some(genre => genre.name === 'Suspense');
  const hasSci = anime.genres.some(genre => genre.name === 'Sci-Fi');
  const hasHOR = anime.genres.some(genre => genre.name === 'Horror');
  const hasFan = anime.genres.some(genre => genre.name === 'Fantasy');
  const hasAdv = anime.genres.some(genre => genre.name === 'Adventure');

  let color;

  if (hasRom) {
    color = hasCom ? '#ff8cc6' : '#ff57a1';
  } else if (hasMys) {
    if (hasSOL) {
      color = '#803e73';
    } else if (hasSus) {
      color = '#5d1170';
    } else if (hasAct) {
      color = '#a81111';
    } else {
      color = '#800080';
    }
  } else if (hasDra) {
    color = hasAct ? '#ff5500' : '#b25c5c';
  } else if (hasSpt) {
    color = '#1E90FF';
  } else if (hasAct) {
    color = hasCom ? '#ffc100' : '#ffa200';
  } else if (hasCom) {
    color = '#FFEB3B';
  } else if (hasSOL) {
    color = '#b8ff9d';
  } else if (hasSus) {
    color = '#4b008e';
  } else {
    color = '#A8B8A1';
  }

  // Sci-Fi... blend the color with light blue
  if (hasSci) {
    const totalGenres = anime.genres.length;
    const sciWeight = 1 / totalGenres; 
    color = blendColors(color, '#5eacff', sciWeight); // Light blue
  }
  if (hasHOR) {
    const totalGenres = anime.genres.length;
    const horWeight = 1.8 / totalGenres; 
    color = blendColors(color, '#420000', horWeight);
  }
  if (hasFan && hasAdv) {
    const totalGenres = anime.genres.length;
    const Weight = 1.4 / totalGenres; 
    color = blendColors(color, '#1db01d', Weight);
  }
  if (hasCom && !hasRom) {
    const totalGenres = anime.genres.length;
    const weight = 1 / totalGenres; 
    color = blendColors(color, '#FFEB3B', weight);
  }
  
  return color;
}


async function formRecomendations(id) {
  let recomList = [];
  try {
    const response = await myCustomGet(mainAPIURL + "/anime/" + id + "/recommendations");
    response.data.slice(0, 4).forEach((recom) => { // only first 4
    //response.data.forEach((recom) => {
      recomList.push({ mal_id: recom.entry.mal_id, votes: recom.votes, name: recom.entry.title });
    });
  } catch (err) {
    console.warn(err)
  }
  return recomList
}

let animeMap = new Map();

let nodes = [];
let links = [];
let isPaused = true;

function drawGraph() {
  const ssize = Math.max(window.innerWidth, window.innerHeight) * 12;
  const width = ssize;
  const height = ssize;
  
  const svg = d3.select("#graph")
    .attr("width", width)
    .attr("height", height);
  
  // Clear previous graph
  svg.selectAll(".link").remove();
  svg.selectAll(".node").remove();
  svg.selectAll(".node-label").remove(); // Clear previous labels

  function stringToSeed(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash < 0 ? -hash : hash; // Ensure non-negative seed
  }

  // init random pos
  nodes.forEach(function(node) {
    //const seed = node.id;
    const seed = stringToSeed(node.color) + node.id%2;
    node.x = seededRandom(seed) * width; 
    node.y = seededRandom(seed + 1) * height; 
  });
  
  
  // for centering screen
  const xValues = nodes.map(node => node.x);
  const yValues = nodes.map(node => node.y);

  const xMin = Math.min(...xValues);
  const xMax = Math.max(...xValues);
  const yMin = Math.min(...yValues);
  const yMax = Math.max(...yValues);

  const centerX = (xMin + xMax) / 2;
  const centerY = (yMin + yMax) / 2;

  // scroll to center of all nodes
  const scrollContainer = document.documentElement || document.body;
  scrollContainer.scrollTo({
    top: centerY - window.innerHeight / 2,
    left: centerX - window.innerWidth / 2,
  });
  
  const simulation = d3.forceSimulation(nodes)
    .force("link", d3.forceLink(links)
      .id(d => d.id)
      .distance(d => d.distance)
    )
    .force("charge", d3.forceManyBody().strength(-400))
    .force("center", d3.forceCenter(width / 2, height / 2))
    .alphaDecay(0.005); // defaults to 0.0228… = 1 - pow(0.001, 1 / 300) 

  // links (edges)
  const link = svg.append("g")
    .selectAll(".link")
    .data(links)
    .enter().append("line")
    .attr("class", "link")
    .style("opacity", d => d.opac);

  // nodes (circles)
  const node = svg.append("g")
    .selectAll(".node")
    .data(nodes)
    .enter().append("circle")
    .attr("class", "node")
    .attr("r", d => d.size ? 2+d.size : 4) // 4 or if score exists
    .style("fill", d => d.color ? d.color : "gray")
    .on("click", function(event, d) {
      window.open(d.url, '_blank');
    })
    .on("mouseover", function(event, d) {
      // Highlight the hovered node and connected nodes/links
      link.style("opacity", link => 
        link.source.id === d.id || link.target.id === d.id ? 1 : 0.1
      );

      node.style("opacity", node => 
        node.id === d.id || 
        links.some(link => 
          (link.source.id === d.id && link.target.id === node.id) || 
          (link.target.id === d.id && link.source.id === node.id)
        ) ? 1 : 0.1
      );

      labels.style("opacity", label => 
        label.id === d.id || 
        links.some(link => 
          (link.source.id === d.id && link.target.id === label.id) || 
          (link.target.id === d.id && link.source.id === label.id)
        ) ? 1 : 0.1
      );
    })
    .on("mouseout", function() {
      // Reset opacity for all nodes and links
      link.style("opacity", d => d.opac);
      node.style("opacity", 1);
      labels.style("opacity", 1);
    })
    .call(d3.drag()
      .on("start", dragstarted)
      .on("drag", dragged)
      .on("end", dragended));

  // labels (names) to nodes
  const labels = svg.append("g")
    .selectAll(".node-label")
    .data(nodes)
    .enter().append("text")
    .attr("class", "node-label")
    .attr("x", d => d.x)
    .attr("y", d => d.y)
    .attr("dy", -15)
    .attr("text-anchor", "middle")
    .text(d => d.name)
    .style("font-size", d => d.size ? `${6+d.size/2}px` : "6px");  // font size bigger if score exists

  function updateNodeVisuals() {
    link
      .attr("x1", d => (d.source && d.target) ? d.source.x : 0)
      .attr("y1", d => (d.source && d.target) ? d.source.y : 0)
      .attr("x2", d => (d.source && d.target) ? d.target.x : 0)
      .attr("y2", d => (d.source && d.target) ? d.target.y : 0);

    node
      .attr("cx", d => d.x)
      .attr("cy", d => d.y);

    labels
      .attr("x", d => d.x)
      .attr("y", d => d.y);
  }
  
  // main update node positions during simulation
  let lastTickTime = Date.now();
  simulation.on("tick", function() {
    if (isPaused) return;
    
    const now = Date.now();
    if (now - lastTickTime < 2000) return; // if 1 second has passed since the last tick
    lastTickTime = now;
    updateNodeVisuals()
  });
  simulation.on("end", function() {
    updateNodeVisuals()
  });

  // drag behavior for nodes
  function dragstarted(event, d) {
    if (!event.active) simulation.alphaTarget(0.9).restart();
    d.fx = d.x;
    d.fy = d.y;
  }

  function dragged(event, d) {
    d.fx = event.x;
    d.fy = event.y;
  }

  function dragended(event, d) {
    if (!event.active) simulation.alphaTarget(0);
    d.fx = null;
    d.fy = null;
  }
}

let lastAnimeMapString = '';
function visualize() {
  if (isPaused) {
    return
  }
  
  try {
    const animeMapString = JSON.stringify(Array.from(animeMap.entries()));
    //localStorage.setItem('animeMap', animeMapString); // save to local storage
    //console.log(animeMap)
    
    if (animeMapString === lastAnimeMapString) {
      lastAnimeMapString = animeMapString;
      return;
    }
    lastAnimeMapString = animeMapString;
    
  } catch (err) {
    console.warn(err)
    alert(err)
  }
  
  // reset
  nodes = [];
  links = [];
  
  animeMap.forEach((pair, mal_id) => {
  //[...animeMap].slice(0, 20000).forEach(([mal_id, pair]) => {
    const anime = pair.anime;

    const recomCount = pair.recoms.length;

    // edges for recommendations
    const sortedRecoms = pair.recoms.sort((a, b) => b.votes - a.votes);
    sortedRecoms.forEach((recommendation, index) => {
      // add link if not exist
      const testGet = animeMap.get(recommendation.mal_id)
      if (testGet) {
        const tGetAnime = testGet.anime
        const targetNode = nodes.find(n => n.id === recommendation.mal_id);
        if (!targetNode) {
          nodes.push({
            id: recommendation.mal_id,
            name: getAnimeName(tGetAnime), // TODO use map name if its found
            url: `https://myanimelist.net/anime/`+tGetAnime.mal_id,
            score: tGetAnime.score,
            color: getAnimeColor(tGetAnime),
          });
        } else {
          targetNode.size = (targetNode.size || 0) + Math.max(recommendation.votes/100,1)**0.3;
        }

        // add (edge) between the current anime and the recommended anime
        
        const linkValue = recommendation.votes / (index + 1) * 4; // aka strength
        links.push({
          source: anime.mal_id,
          target: recommendation.mal_id,
          value: linkValue,
          distance: Math.min(1 / linkValue * 40 ** 1.5, 20),
          opac: Math.min(1, linkValue / 10)
        });
      }
                        
    });
    
   // add if not exist
    if (!nodes.find(n => n.id === anime.mal_id)) {
      nodes.push({
        id: anime.mal_id,
        name: getAnimeName(anime),
        url: `https://myanimelist.net/anime/`+anime.mal_id,
        score: anime.score,
        color: getAnimeColor(anime),
      });
    }
    
  });
  
  const linkedNodeIds = new Set(
    links.flatMap(link => [link.source, link.target])
  );

  nodes = nodes.filter(node => linkedNodeIds.has(node.id));
  
  drawGraph();
}

async function addAnime(anime) {
  if (animeMap.get(anime.mal_id)) {
    return; // already in the list
  }
  if (anime.score < 7 && anime.popularity > 2000) {
    // less than 7 and not popular
    if (
      (anime.year >= 2016 && anime.members >= 200000) ||
      (anime.year >= 2020 && anime.members >= 100000)
    ) {
    } else {
      //console.warn(`ignore [${getAnimeName(anime)}]`)
      return; // aired 2020 or earlier and good member count
    }
  }
  if (anime.members < 10000 || anime.score < 6) {
    // less than 6 and minimal members count
    if (anime.popularity > 2000) { // and its not popular
      return;
    }
  }
  if (anime.popularity == 0 && anime.favorites == 0) { // doesnt exist :skull:
    return;
  }
  
  await sleep(speedMS);
  const recoms = await formRecomendations(anime.mal_id)
  
  //console.log([...anime.genres, ...anime.themes].map(({ name }) => ({ name })))
  
  const newAnime = {
    "mal_id": anime.mal_id,
    genres: [...anime.genres, ...anime.themes].map(({ name }) => ({ name })),
    "favorites": anime.favorites,
    "popularity": anime.popularity,
    "score": anime.score,
    "title_english": anime.title_english,
    "title": anime.title,
    "year": anime.year,
  }
  animeMap.set(anime.mal_id, {anime: newAnime, recoms});
}

let selfGenElm = document.getElementById("sgen")
async function animesNow(mpage) {
  const params = {
    //filter: 'favorite',
    //rating: 'r',
    sfw: false,
    limit: 25,
    page: mpage,
  };

  try {
    const response = await myCustomGet(mainAPIURL + "/seasons/now", params);
    for (const anime of response.data) {
      await addAnime(anime);
      selfGenElm.textContent = `(${animeMap.size}), page ${mpage} | ${getAnimeName(anime)} /seasons/now`
    }
    visualize();

    if (response && response.pagination && response.pagination.has_next_page) {
      await sleep(speedMS);
      await animesNow(mpage + 1);
    }
  } catch (err) {
    console.warn(err);
    await sleep(speedMS+1000);
    await animesNow(mpage); // retry
  }
}

async function animesTopR(mpage) {
  const params = {
    filter: 'favorite',
    rating: 'r',
    sfw: false,
    limit: 25,
    page: mpage
  };

  try {
    const response = await myCustomGet(mainAPIURL + "/top/anime", params);
    for (const anime of response.data) {
      await addAnime(anime);
      selfGenElm.textContent = `(${animeMap.size}) R+ page ${mpage} | ${getAnimeName(anime)}`
    }
    visualize();

    if (response && response.pagination && response.pagination.has_next_page) {
      await sleep(speedMS);
      await animesTopR(mpage + 1);
    }
  } catch (err) {
    console.warn(err);
    await sleep(speedMS+1000);
    await animesTopR(mpage); // retry
  }
}

async function animesTopR17(mpage) {
  const params = {
    filter: 'favorite',
    rating: 'r17',
    sfw: false,
    limit: 25,
    page: mpage
  };

  try {
    const response = await myCustomGet(mainAPIURL + "/top/anime", params);
    for (const anime of response.data) {
      await addAnime(anime);
      selfGenElm.textContent = `(${animeMap.size}) R-17 page ${mpage} | ${getAnimeName(anime)}`
    }
    visualize();

    if (response && response.pagination && response.pagination.has_next_page) {
      await sleep(speedMS);
      await animesTopR17(mpage + 1);
    }
  } catch (err) {
    console.warn(err);
    await sleep(speedMS+1000);
    await animesTopR17(mpage); // retry
  }
}

async function animesTopPg13(mpage) {
  const params = {
    filter: 'favorite',
    rating: 'pg13',
    sfw: false,
    limit: 25,
    page: mpage
  };

  try {
    const response = await myCustomGet(mainAPIURL + "/top/anime", params);
    for (const anime of response.data) {
      await addAnime(anime);
      selfGenElm.textContent = `(${animeMap.size}) PG-13 page ${mpage} | ${getAnimeName(anime)}`
    }
    visualize();

    if (response && response.pagination && response.pagination.has_next_page) {
      await sleep(speedMS);
      await animesTopPg13(mpage + 1);
    }
  } catch (err) {
    console.warn(err);
    await sleep(speedMS+1000);
    await animesTopPg13(mpage); // retry
  }
}

/*
const recoms = await formRecomendations(57334)
*/

let started = false
async function start() {
  isPaused = false
  started = true;
  visualize()
}

function createBidirectionalAnimeMap(originalMap) {
  const newAnimeMap = new Map();

  // Iterate through the original animeMap
  originalMap.forEach((pair, mal_id) => {
    // Clone the current anime and its recommendations
    const newPair = {
      anime: pair.anime,
      recoms: [...pair.recoms] // Clone the recommendations array
    };

    // Ensure the anime is in the new map
    if (!newAnimeMap.has(mal_id)) {
      newAnimeMap.set(mal_id, newPair);
    }

    // Process recommendations for this anime
    pair.recoms.forEach(recommendation => {
      // Clone or add the target anime to the new map
      if (!newAnimeMap.has(recommendation.mal_id)) {
        const targetAnime = originalMap.get(recommendation.mal_id);
        if (targetAnime) {
          newAnimeMap.set(recommendation.mal_id, {
            anime: targetAnime.anime,
            recoms: [...targetAnime.recoms]
          });
        }
      }

      // Add a reverse recommendation if not already present
      const targetPair = newAnimeMap.get(recommendation.mal_id);
      if (targetPair) {
        const reverseExists = targetPair.recoms.some(
          recom => recom.mal_id === mal_id
        );

        if (!reverseExists) {
          let voteAdd = recommendation.votes;
          if (pair.anime.year < targetPair.anime.year) { // older anime than it gets less effect
            voteAdd /= 2;
          }
          targetPair.recoms.push({
            mal_id: mal_id,
            votes: voteAdd // Copy votes or customize logic
          });
        }
      }
      
    });
  });

  return newAnimeMap;
}


// options
let recomVoteStrength = 8; // how much the votes matter..  6
let recomVoteUnit = 4; // bigger = stronger vote/linkValue strength.. 2
let animeScoreStrength = 4; // how much the score matter.. 4
let punishYearsLessThan = 2010; // punish animes less than or = year.. 2008
let promoteEarlierAnimesMult = 3; // bigger=promote earlier animes.. 3

let PEAM = promoteEarlierAnimesMult;

let allGenres = {};
function getConnectedAnimes(malIds) {
  const bidirectionalAnimeMap = createBidirectionalAnimeMap(animeMap);
  let resultAnimes = {};

  let allGenresCounter = {};
  let highestYear = -Infinity;
  animeMap.forEach((value, key) => {
    if (value.anime) {
      if (value.anime.year > highestYear) {
        highestYear = value.anime.year;
      }

      value.anime.genres.forEach(genre => {
        if (!allGenres[genre.name]) {
          allGenres[genre.name] = 1;//Math.random() + 1;
        }
        if (allGenresCounter[genre.name]) {
          allGenresCounter[genre.name] += 1;
        } else {
          allGenresCounter[genre.name] = 1;
        }
      });
    }
  });
  
  const configContainer = document.getElementById("config-container");
  configContainer.innerHTML = ""; // Clear existing content
  
  const yearControll = document.createElement("button");
  if (PEAM == promoteEarlierAnimesMult) {
    yearControll.textContent = `〇 Boost Newer Animes`;
  } else {
    yearControll.textContent = `🟢 Boost Newer Animes`;
  }
  yearControll.addEventListener("click", () => {
    if (PEAM == promoteEarlierAnimesMult) {
      promoteEarlierAnimesMult = PEAM*3
    } else {
      promoteEarlierAnimesMult = PEAM
    }
    listSelectedAnimes();
  })
  configContainer.appendChild(yearControll);

  Object.keys(allGenres).sort((a, b) => allGenresCounter[b] - allGenresCounter[a]).forEach((genre) => {
    if (allGenresCounter[genre] > 10) {
    const genreToggle = document.createElement("button");
    if (allGenres[genre] == 1) {
      genreToggle.textContent = `〇 ${genre} (${allGenresCounter[genre]})`;
    } else {
      genreToggle.textContent = `🟢 ${genre} (${allGenresCounter[genre]})`;
    }
    genreToggle.dataset.genre = genre;

    genreToggle.addEventListener("click", () => {
      if (allGenres[genre] == 1) {
        allGenres[genre] = 3; // Set to 4 when "on"
      } else {
        allGenres[genre] = 1; // Set to 1 when "off"
      }
      console.log(`${genre} is now ${allGenres[genre]}`);
      listSelectedAnimes();
    });

    // Append the toggle to the config container
    configContainer.appendChild(genreToggle);
    }
  });
  
  malIds.forEach(malId => {
    let visited = new Set();
    let queue = [{ mal_id: malId, steps: 0 }]; // BFS queueq
    
    while (queue.length > 0) {
      const { l_val, mal_id, steps } = queue.shift();
      const pair = bidirectionalAnimeMap.get(mal_id);

      if (!pair || visited.has(mal_id)) continue;

      
      visited.add(mal_id);

      
      if (!resultAnimes[mal_id]) {
        resultAnimes[mal_id] = {
          totalSteps: 0,
          count: 0
        };
      }
      
      // accumulate the steps for this anime
      if (!malIds.includes(mal_id)) {
        resultAnimes[mal_id].totalSteps += steps;
        resultAnimes[mal_id].count += 1;
      }
      
      const sortedRecoms = pair.recoms.sort((a, b) => b.votes - a.votes);
      sortedRecoms.forEach((recommendation, index) => {
        if (!visited.has(recommendation.mal_id)) {
          const linkValue = recommendation.votes*recomVoteStrength / (index + 1) * 4; // aka strength
          let recomCount2 = 0
          let pair2 = bidirectionalAnimeMap.get(recommendation.mal_id)
          if (pair2 && pair2.recoms) {
            recomCount2 = Math.min(pair2.recoms.length, 16)*(10-pair2.anime.score)*animeScoreStrength // the higher the math.min will make it so it punishes popularly recomended/big animes
            //console.log(pair2.anime.year, getAnimeName(pair2.anime))
            if (pair2.anime.year && pair2.anime.year <= punishYearsLessThan && pair2.anime.popularity > 400) {
              recomCount2 *= 2 // punish older animes
            }
            if (pair2.anime.score < 7) {
              recomCount2 *= 2 // punish lower rated
            }
            if (pair2.anime.year == highestYear) {
              recomCount2 /= 4 // promote this years anime
            } else if (pair2.anime.year >= highestYear - 2) {
              recomCount2 /= 2 // promote close year animes
            }
          }
          
          let genreDiff = 0;
          if (pair2) {
            pair2.anime.genres.forEach(genre => {
              //if (allGenres[genre.name] > genreMult) {
                //genreMult = allGenres[genre.name]
              //}
              if (allGenres[genre.name] == 1) { // off
                genreDiff--;
              } else {
                genreDiff+=(pair2.anime.genres.length);
              }
            });
            genreDiff = genreDiff/(pair2.anime.genres.length) // normalize to between -1 and 1
          }
          
          if (pair2 && (2+genreDiff) > 3) {
            console.log((2+genreDiff), getAnimeName(pair2.anime))
          }
          let myRecomVoteUnit = recomVoteUnit
          if (pair2 && pair2.anime.year > pair.anime.year) {
            myRecomVoteUnit/=promoteEarlierAnimesMult
          }
          queue.push({
            mal_id: recommendation.mal_id,
            //steps: steps + 0.1 // normal
            //steps: steps + 0.5 + 1/(1+linkValue) // for more popular ones
            steps: 0.5 + (steps + myRecomVoteUnit/(1+linkValue) + recomCount2/100)/(2+genreDiff) // get the underated
          });
        }
      });
      
    }
  });

  // after BFS for all malIds, calc the average score
  let scoredAnimes = Object.keys(resultAnimes)
    .filter(mal_id => !malIds.includes(mal_id))  // filter out the given malIds from the result
    .map(mal_id => {
      const data = resultAnimes[mal_id];
      const avgSteps = data.count > 0 ? data.totalSteps / data.count : Infinity;  // Avoid division by 0
      return {
        mal_id,
        score: avgSteps === Infinity ? Infinity : avgSteps  // unreachable as Infinity
      };
    })
    .sort((a, b) => a.score - b.score);  // by average score (lowest first)

  return scoredAnimes;
}

const searchBar = document.getElementById('searchBar');
const searchResults = document.getElementById('searchResults');

let selectedAnimes = {}
const summaryCache = {};

function listSelectedAnimes() {
  const list1 = document.getElementById('list1');
  list1.innerHTML = "";
  for (let key in selectedAnimes) {
    const mal_id = selectedAnimes[key]
    const anime = animeMap.get(mal_id).anime;
    
    const engAnimTitle = getAnimeName(anime)

    const listItemElement = document.createElement('li');
    listItemElement.textContent = engAnimTitle;
    listItemElement.addEventListener('click', () => {
      delete selectedAnimes[key];
      listSelectedAnimes();
    });
    
    list1.appendChild(listItemElement);
  }
  
  const list2 = document.getElementById('list2');
  list2.innerHTML = "";
  
  const givenMalIds = Object.values(selectedAnimes);
  const connectedAnimes = getConnectedAnimes(givenMalIds);

  if (connectedAnimes.length > 0) {
    const validPairs = connectedAnimes.filter(pair => pair.score !== Infinity);
    if (validPairs.length > 0) {
      console.log("Worse recomendation: ", validPairs[validPairs.length - 1]);
    }
  }
  
  let counted = 0; // Keep track of how many items have been loaded
  const itemsPerPage = 6; // Number of items to load per page
  function loadMoreAnimes() {
    connectedAnimes.slice(counted, counted + itemsPerPage).forEach(pair => {
      counted++
      const cpair = animeMap.get(Number(pair.mal_id))
      const anime = cpair.anime;
      const engAnimTitle = getAnimeName(anime)
      const roundedScore = (pair.score*2).toFixed(1)
      
      const animeContainer = document.createElement('div');
      
      const listItemElement = document.createElement('p');
      
      const scoreElm = document.createElement('p');
      scoreElm.style = `text-align: right;padding-right: 40px;color:#888`
      scoreElm.innerText = `${anime.year} ★ ${anime.score}`;

      const scoreSpan = document.createElement('span');
      scoreSpan.textContent = `${roundedScore}, `;
      scoreSpan.classList.add('small-id');
      listItemElement.appendChild(scoreSpan);
      listItemElement.append(`${engAnimTitle}`);
      //if (counted < 13) {
        fetch(`api/anime?id=${pair.mal_id}`, { method: "GET" })
        .then(response => {
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          return response.text()
        })
        .then(async  (data) => {
          //const metaTags = {};
          const regex = /<meta\s+[^>]*?content="([^"]*)"[^>]*?>/g;
          let match;
          let descResult;
          while ((match = regex.exec(data)) !== null) {
            const contentValue = match[1];
            const nameMatch = /name="([^"]+)"/.exec(match[0]);

            if (nameMatch) {
              const nameValue = nameMatch[1];
              //metaTags[nameValue] = contentValue;
              //console.log(nameMatch, nameValue)
              
              if (nameValue === 'twitter:image:src') {
                const imgElement = document.createElement('img');
                imgElement.src = contentValue;
                imgElement.style.width = '160px';
                imgElement.style.height = '200px';
                imgElement.style.objectFit = 'cover';
                imgElement.style.float = 'right';
                imgElement.style.paddingLeft = '10px';
                
                listItemElement.appendChild(imgElement);
              } else if (nameValue === 'description') {
                //console.log(contentValue)
                descResult = contentValue.split("community and database. ")[1] || "";
              }
            }
          }
          
          if (descResult) {
            const parser = new DOMParser();
            const decodedString = parser.parseFromString(descResult, "text/html").documentElement.textContent;

            let summarizedTxt = decodedString.trim();
            try {
              if (summaryCache[decodedString]) {
                summarizedTxt = summaryCache[decodedString]
              } else {
                let resp = await fetch("https://api.smrzr.io/v1/summarize?&num_sentences=1", {
                  "referrer": "https://smrzr.io/",
                  "body": decodedString.trim(),
                  "method": "POST",
                });
                summarizedTxt = await resp.json()
                summarizedTxt = summarizedTxt.summary
                summaryCache[decodedString] = summarizedTxt;
              }
            } catch (err) {
              console.log(err)
            }
            
            // Create a paragraph for descResult
            const descParagraph = document.createElement('p');
            descParagraph.textContent = summarizedTxt;
            descParagraph.style.marginTop = '10px';
            descParagraph.style.fontStyle = 'italic';
            descParagraph.style.color = '#777';

            listItemElement.appendChild(descParagraph);
          }

          //console.log(metaTags); // Process the meta tag map here
        })
        .catch(error => {
          console.error('Error fetching data:', error);
        });
      //}

      animeContainer.addEventListener('click', () => {
        window.open(`https://myanimelist.net/anime/`+anime.mal_id, '_blank');
      });

      animeContainer.appendChild(scoreElm)
      animeContainer.appendChild(listItemElement);
      list2.insertBefore(animeContainer, loadMoreBtn);
    });

    counted += itemsPerPage;

    if (counted >= connectedAnimes.length) {
      loadMoreBtn.style.display = 'none';
    }
  }
  
  const loadMoreBtn = document.createElement('button');
  loadMoreBtn.textContent = 'Load More';
  loadMoreBtn.addEventListener('click', loadMoreAnimes);

  list2.appendChild(loadMoreBtn);
  loadMoreAnimes();
}

searchBar.addEventListener('input', () => {
  const svg = document.getElementById('graph')
  
  const query = searchBar.value.toLowerCase();
  searchResults.innerHTML = '';
  
  if (query.length < 1) {
    return;
  }

  let resultCount = 0;
  animeMap.forEach((pair, mal_id) => {
    if (resultCount >= 20) return;
    
    
    const anime = pair.anime;
    const engAnimTitle = getAnimeName(anime)
    if (anime.title.toLowerCase().includes(query) || engAnimTitle.toLowerCase().includes(query)) {
      resultCount++;
      const resultItem = document.createElement('li');
      
      const label = Array.from(svg.querySelectorAll('text')).find(textElement => textElement.textContent.trim() === engAnimTitle);
      if (!label) {
        resultItem.innerHTML = `<span style="color: red;">${engAnimTitle}</span> <span class="small-id">id_${anime.mal_id}</span>`;
      } else {
        resultItem.innerHTML = `${engAnimTitle} <span class="small-id">id_${anime.mal_id}</span>`;
      }
      
      resultItem.addEventListener('click', () => {
        selectedAnimes[mal_id] = mal_id
        listSelectedAnimes()
        
        if (label) {
          // Get the coordinates of the label element
          const labelCoords = label.getBoundingClientRect();

          // Select the container (documentElement or body)
          const container = document.documentElement || document.body;


          container.scrollTo({
            left: container.scrollLeft + labelCoords.left - (container.clientWidth / 2) + (labelCoords.width / 2),
            top: container.scrollTop + labelCoords.top - (container.clientHeight / 2) + (labelCoords.height / 2),    // Vertical scroll
            behavior: 'smooth'  // Smooth scroll
          });
        }
      });
      
      searchResults.appendChild(resultItem);
    }
  });

  // no results
  if (!searchResults.hasChildNodes() && query !== '') {
    const noResults = document.createElement('li');
    noResults.textContent = 'No results found.';
    searchResults.appendChild(noResults);
  }
});
  
function printAnimeMapSize(obj) {
  function formatSizeToMB(size) {
    const sizeInMB = size / (1024 * 1024);  // bytes to MB
    return sizeInMB.toFixed(2).toLocaleString();  // to 2 decimal places and formatted with commas
  }
  const stringifiedMap = JSON.stringify(Array.from(obj.entries()));
  const originalSize = new TextEncoder().encode(stringifiedMap).length;
  console.log(`animeData | size: ${formatSizeToMB(originalSize)} MB`);
}
async function main() {
  try {
    //const animeMapString = localStorage.getItem('animeMap');
    const response = await fetch('/api/get-anime', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
    });

    if (!response.ok) {
      console.log("[FAILED] to get anime map")
      alert("failed to get anime map [NET ERR]")
    }

    const data = await response.json()

    const binaryData = Uint8Array.from(atob(data.base64CompressedData), c => c.charCodeAt(0));

    const decompressedData = pako.ungzip(binaryData, { to: 'string' });
    const animeObj = JSON.parse(decompressedData);
    //const newanimeMap = new Map();

    Object.entries(animeObj).forEach(([key, { anime, recoms }]) => {
      const newAnime = {
        "mal_id": anime.mal_id,
        genres: anime.genres.map(({ name }) => ({ name })),
        "favorites": anime.favorites,
        "popularity": anime.popularity,
        "score": anime.score,
        "title_english": anime.title_english,
        "title": anime.title,
        "year": anime.year,
      };
      animeMap.set(anime.mal_id, { anime: newAnime, recoms });
    });
    
    //animeMap = newanimeMap
    console.log('[Success] mainAnimeMap', animeMap);
    printAnimeMapSize(animeMap)
  } catch (err) {
    console.error('[failed]:', err);
    alert("[FAILED TO LOAD animeMap], please refresh...")
  }
}

main()

function htmlStart(button) {
  if (started == false) {
    button.textContent = "Running"
    start()
  } else {
    console.log("Pause set to",!isPaused)
    if (button.textContent == "Running") {
      isPaused = true
      button.textContent = "Paused"
    } else {
      isPaused = false
      button.textContent = "Running"
      visualize();
    }
  }
}

function htmlCommit(button) {
  const password = prompt("enter password:");
  
  const animeMapArray = Array.from(animeMap.entries());
  const requestData = {
    pass: password,
    animeMap: animeMapArray
  };
  
  button.textContent = "Starting Commit"
  
  fetch('api/commit-anime', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestData)
  }).then(response => {
    if (!response.ok) {
      alert(`HTTP error! status: ${response.status}`);
      return;
    }
    button.textContent = "Commit Ok!"
  }).catch(error => {
    alert(`An error occurred: ${error.message}`);
    button.textContent = "Commit Failed"
  });
  
}

let startSelfGen = false
async function htmlSelfGen(button) {
  const password = prompt("enter password:");
  if (startSelfGen == true || password != "start") {
    return;
  }
  startSelfGen = true
  animeMap = new Map(); // clear
  animeMap.clear();
  console.log(animeMap)
  button.textContent = `Self Generate (Starting)`
  console.log("starting self generaton", animeMap)
  await sleep(speedMS);
  await animesNow(1);
  await sleep(speedMS);
  console.log("starting r17 animes")
  await animesTopR17(1);

  await sleep(speedMS);
  console.log("starting pg13 animes")
  await animesTopPg13(1);
  
  await sleep(speedMS);
  console.log("starting r+ animes")
  await animesTopR(1);
  button.textContent = `Self Generate (Ended)`
  
  console.log(animeMap)
  printAnimeMapSize(animeMap)
}

function htmlConfig(button) {
  const configContainer = document.getElementById("config-container");
  if (configContainer.style.display === "none" || !configContainer.style.display) {
    
    /*animeMap.forEach((value, key) => {
      if (value.anime) {
        value.anime.genres.forEach(genre => {
          if (!allGenres[genre.name]) {
            allGenres[genre.name] = 1;//Math.random() + 1;
          }
        });
      }
    });
    
    const configContainer = document.getElementById("config-container");
    configContainer.innerHTML = ""; // Clear existing content

    Object.keys(allGenres).forEach((genre) => {
      const genreToggle = document.createElement("button");
      if (allGenres[genre] == 1) {
        genreToggle.textContent = `⚪ ${genre}`;
      } else {
        genreToggle.textContent = `🟢 ${genre}`;
      }
      genreToggle.dataset.genre = genre;

      genreToggle.addEventListener("click", () => {
        if (allGenres[genre] == 1) {
          allGenres[genre] = 3; // Set to 4 when "on"
        } else {
          allGenres[genre] = 1; // Set to 1 when "off"
        }
        console.log(`${genre} is now ${allGenres[genre]}`);
        listSelectedAnimes();
      });

      // Append the toggle to the config container
      configContainer.appendChild(genreToggle);
    });*/
    getConnectedAnimes([]);
    
    configContainer.style.display = "flex";
  } else {
    configContainer.style.display = "none";
  }
}