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