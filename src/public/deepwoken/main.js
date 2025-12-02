const potionData = [
  {
    "Ingredient": "Alestrian Coral",
    "Health": null,
    "Ether": null,
    "Dmg Buff": -0.0175,
    "Posture Dmg": -0.05,
    "Posture Resist": null,
    "Speed Buff": 0.25,
    "Health Regen": null,
    "Ether Regen": null,
    "Sanity Regen": null,
    "Duration": null
  },
  {
    "Ingredient": "Bamboo",
    "Health": null,
    "Ether": -23,
    "Dmg Buff": null,
    "Posture Dmg": null,
    "Posture Resist": 0.1,
    "Speed Buff": null,
    "Health Regen": null,
    "Ether Regen": null,
    "Sanity Regen": null,
    "Duration": null
  },
  {
    "Ingredient": "Beeswax",
    "Health": null,
    "Ether": null,
    "Dmg Buff": null,
    "Posture Dmg": null,
    "Posture Resist": null,
    "Speed Buff": -0.05,
    "Health Regen": 0.85,
    "Ether Regen": null,
    "Sanity Regen": null,
    "Duration": null
  },
  {
    "Ingredient": "Bluecap",
    "Health": -5,
    "Ether": 23,
    "Dmg Buff": null,
    "Posture Dmg": null,
    "Posture Resist": null,
    "Speed Buff": null,
    "Health Regen": null,
    "Ether Regen": null,
    "Sanity Regen": 3.75,
    "Duration": null
  },
  {
    "Ingredient": "Browncap",
    "Health": -4,
    "Ether": null,
    "Dmg Buff": 0.02,
    "Posture Dmg": null,
    "Posture Resist": null,
    "Speed Buff": null,
    "Health Regen": null,
    "Ether Regen": null,
    "Sanity Regen": null,
    "Duration": null
  },
  {
    "Ingredient": "Calabash",
    "Health": null,
    "Ether": null,
    "Dmg Buff": null,
    "Posture Dmg": null,
    "Posture Resist": 0.1,
    "Speed Buff": null,
    "Health Regen": null,
    "Ether Regen": -0.05,
    "Sanity Regen": null,
    "Duration": null
  },
  {
    "Ingredient": "Chum",
    "Health": null,
    "Ether": null,
    "Dmg Buff": null,
    "Posture Dmg": null,
    "Posture Resist": null,
    "Speed Buff": null,
    "Health Regen": null,
    "Ether Regen": null,
    "Sanity Regen": -0.1,
    "Duration": null
  },
  {
    "Ingredient": "Crustacean Meat",
    "Health": null,
    "Ether": null,
    "Dmg Buff": -0.0175,
    "Posture Dmg": null,
    "Posture Resist": null,
    "Speed Buff": null,
    "Health Regen": null,
    "Ether Regen": null,
    "Sanity Regen": null,
    "Duration": 0.2
  },
  {
    "Ingredient": "Dentifilo",
    "Health": -2,
    "Ether": 23,
    "Dmg Buff": null,
    "Posture Dmg": null,
    "Posture Resist": null,
    "Speed Buff": null,
    "Health Regen": null,
    "Ether Regen": null,
    "Sanity Regen": null,
    "Duration": null
  },
  {
    "Ingredient": "Glumfig",
    "Health": 5,
    "Ether": null,
    "Dmg Buff": -0.02,
    "Posture Dmg": null,
    "Posture Resist": -0.15,
    "Speed Buff": null,
    "Health Regen": null,
    "Ether Regen": null,
    "Sanity Regen": -0.1,
    "Duration": null
  },
  {
    "Ingredient": "Gobletto",
    "Health": null,
    "Ether": null,
    "Dmg Buff": null,
    "Posture Dmg": null,
    "Posture Resist": null,
    "Speed Buff": -0.05,
    "Health Regen": 0.85,
    "Ether Regen": null,
    "Sanity Regen": null,
    "Duration": null
  },
  {
    "Ingredient": "Marram Grass",
    "Health": null,
    "Ether": -23,
    "Dmg Buff": null,
    "Posture Dmg": null,
    "Posture Resist": 0.1,
    "Speed Buff": null,
    "Health Regen": null,
    "Ether Regen": null,
    "Sanity Regen": null,
    "Duration": null
  },
  {
    "Ingredient": "Ongo",
    "Health": null,
    "Ether": null,
    "Dmg Buff": null,
    "Posture Dmg": 0.1,
    "Posture Resist": -0.05,
    "Speed Buff": null,
    "Health Regen": null,
    "Ether Regen": null,
    "Sanity Regen": null,
    "Duration": null
  },
  {
    "Ingredient": "Plumfruit",
    "Health": null,
    "Ether": null,
    "Dmg Buff": 0.02,
    "Posture Dmg": null,
    "Posture Resist": null,
    "Speed Buff": null,
    "Health Regen": -0.3,
    "Ether Regen": null,
    "Sanity Regen": null,
    "Duration": null
  },
  {
    "Ingredient": "Pomar",
    "Health": -3,
    "Ether": null,
    "Dmg Buff": null,
    "Posture Dmg": null,
    "Posture Resist": null,
    "Speed Buff": 0.25,
    "Health Regen": null,
    "Ether Regen": null,
    "Sanity Regen": null,
    "Duration": null
  },
  {
    "Ingredient": "Redd",
    "Health": 4,
    "Ether": null,
    "Dmg Buff": null,
    "Posture Dmg": null,
    "Posture Resist": null,
    "Speed Buff": null,
    "Health Regen": null,
    "Ether Regen": -0.05,
    "Sanity Regen": null,
    "Duration": -0.25
  },
  {
    "Ingredient": "Sap",
    "Health": null,
    "Ether": null,
    "Dmg Buff": null,
    "Posture Dmg": null,
    "Posture Resist": null,
    "Speed Buff": -0.05,
    "Health Regen": null,
    "Ether Regen": 0.9,
    "Sanity Regen": null,
    "Duration": null
  },
  {
    "Ingredient": "Scallop",
    "Health": null,
    "Ether": null,
    "Dmg Buff": null,
    "Posture Dmg": null,
    "Posture Resist": null,
    "Speed Buff": null,
    "Health Regen": null,
    "Ether Regen": null,
    "Sanity Regen": -0.1,
    "Duration": null
  },
  {
    "Ingredient": "Seaweed Bundle",
    "Health": null,
    "Ether": null,
    "Dmg Buff": null,
    "Posture Dmg": null,
    "Posture Resist": null,
    "Speed Buff": null,
    "Health Regen": null,
    "Ether Regen": null,
    "Sanity Regen": -0.1,
    "Duration": null
  },
  {
    "Ingredient": "Spider Egg",
    "Health": null,
    "Ether": null,
    "Dmg Buff": null,
    "Posture Dmg": null,
    "Posture Resist": null,
    "Speed Buff": null,
    "Health Regen": null,
    "Ether Regen": null,
    "Sanity Regen": null,
    "Duration": 0.5
  },
  {
    "Ingredient": "Urchin",
    "Health": null,
    "Ether": null,
    "Dmg Buff": null,
    "Posture Dmg": null,
    "Posture Resist": null,
    "Speed Buff": null,
    "Health Regen": null,
    "Ether Regen": null,
    "Sanity Regen": -0.1,
    "Duration": null
  },
  {
    "Ingredient": "Thresher Egg",
    "Health": null,
    "Ether": null,
    "Dmg Buff": null,
    "Posture Dmg": null,
    "Posture Resist": null,
    "Speed Buff": null,
    "Health Regen": null,
    "Ether Regen": null,
    "Sanity Regen": -0.1,
    "Duration": null
  },
  {
    "Ingredient": "Wheat",
    "Health": null,
    "Ether": null,
    "Dmg Buff": -0.0175,
    "Posture Dmg": null,
    "Posture Resist": null,
    "Speed Buff": null,
    "Health Regen": null,
    "Ether Regen": 0.9,
    "Sanity Regen": null,
    "Duration": null
  }
]

const stats = ["Health","Ether","Dmg Buff","Posture Dmg","Posture Resist","Speed Buff","Health Regen","Ether Regen","Sanity Regen","Duration"];
const settings = { maxTotal: 5, maxPerIngredient: 3 };

function bruteForceAll(potionData, stats, settings) {
  const N = potionData.length;
  const maxPerIngredient = settings.maxPerIngredient;
  const results = {};
  for (const s of stats) {
    results[s] = { max: { value: -Infinity, combos: [] }, min: { value: Infinity, combos: [] } };
  }

  const counts = new Array(N).fill(0);

  // recursion enumerates all count-vectors where sum(counts) between 1..maxTotal
  function recurse(i, remaining, totalCount) {
    if (i === N) {
      if (totalCount === 0) return; // skip empty potion
      // compute totals (null treated as 0)
      const totals = {};
      for (const s of stats) totals[s] = 0;
      for (let j = 0; j < N; j++) {
        const c = counts[j];
        if (c === 0) continue;
        const item = potionData[j];
        for (const s of stats) {
          const v = item[s];
          if (v !== null && v !== undefined) totals[s] += v * c;
        }
      }

      if (counts.some(x => x > 3) && totalCount < settings.maxTotal) {
        for (const s of stats) totals[s] /= 2;
      }

      // update min/max
      for (const s of stats) {
        const v = totals[s];
        if (v > results[s].max.value) {
          results[s].max.value = v;
          results[s].max.combos = [counts.slice()];
        } else if (v === results[s].max.value) {
          results[s].max.combos.push(counts.slice());
        }
        if (v < results[s].min.value) {
          results[s].min.value = v;
          results[s].min.combos = [counts.slice()];
        } else if (v === results[s].min.value) {
          results[s].min.combos.push(counts.slice());
        }
      }
      return;
    }

    const maxChoice = Math.min(maxPerIngredient, remaining);
    for (let c = 0; c <= maxChoice; c++) {
      counts[i] = c;
      recurse(i + 1, remaining - c, totalCount + c);
    }
    counts[i] = 0; // reset on backtrack
  }

  recurse(0, settings.maxTotal, 0);
  return results;
}

function prettyDecode(counts, potionData) {
  return counts.map((c, i) => c ? `${c}x ${potionData[i].Ingredient}` : null).filter(Boolean).join(", ");
}

function renderStats(out, potionData, maxExamples = 3) {
  const panel = document.getElementById('potion-panel');
  panel.innerHTML = '';
  for (const stat of Object.keys(out)) {
    const { max, min } = out[stat];
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <div class="potion-stat">${stat}</div>
      <div class="muted">MAX</div>
      <div class="val">${Number.isFinite(max.value) ? max.value : '—'}</div>
      <div class="muted">example combo(s):</div>
      <div>${(max.combos.slice(0,maxExamples).map(c => `<div class="combo">• ${prettyDecode(c, potionData)}</div>`).join('') || '<div class="combo">—</div>')}</div>
      <hr />
      <div class="muted">MIN</div>
      <div class="val">${Number.isFinite(min.value) ? min.value : '—'}</div>
      <div class="muted">example combo(s):</div>
      <div>${(min.combos.slice(0,maxExamples).map(c => `<div class="combo">• ${prettyDecode(c, potionData)}</div>`).join('') || '<div class="combo">—</div>')}</div>
    `;
    panel.appendChild(card);
  }
}

const computed = bruteForceAll(potionData, stats, settings);
renderStats(computed, potionData);


function buildIngredientTable(data, stats) {
  const table = document.getElementById("ingredientTable");

  const header = document.createElement("tr");
  header.innerHTML = `<th>Ingredient</th>` + stats.map(s => `<th>${s}</th>`).join("");
  table.appendChild(header);

  for (const item of data) {
    const row = document.createElement("tr");

    let cells = `<td><b>${item.Ingredient}</b></td>`;
    for (const s of stats) {
      const v = item[s];

      let color = "";
      if (typeof v === "number") {
        if (v > 0) color = " style='background:#85d76a55'";
        else if (v < 0) color = " style='background:#ff6d6d55'";
      }

      cells += `<td${color}>${v === null ? "" : v}</td>`;
    }

    row.innerHTML = cells;
    table.appendChild(row);
  }
}

buildIngredientTable(potionData, stats);

import {
  Card,
  wepReqs,
  baseReqs,
  attunementReqs,
  Character
} from "./classes.js";

export function parseCardData(raw) {
  const cards = new Map();
  for (const key in raw) {
    cards.set(key, new Card(key, raw[key]));
  }
  return cards;
}

async function loadCards() {
  const res = await fetch("/api/deepTalents");
  const json = await res.json();
  const cardsMap = parseCardData(json);
  const container = document.getElementById("cards");

  console.log("cards:",cardsMap);

  const allStats = new Set();

  const cardsArray = Array.from(cardsMap.values());
  cardsArray.sort((a, b) => b.sumReqPoints() - a.sumReqPoints());
  for (const card of cardsArray) {
    const div = card.toDiv();
    container.appendChild(div);

    const stats = card.stats; // can be null or list of strings...
    if (stats != null) {
      for (const stat of stats) {
        if (stat) {
          const statName = stat.trim().replace(/^\+\d+%?\s*/, "")
          allStats.add(statName);
        }
      }
    }

    //
  }

  console.log("allStats:", allStats);
}
loadCards();