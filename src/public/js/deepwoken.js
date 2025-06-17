async function fetchTalents() {
  try {
    const response = await fetch(
      "https://api.deepwoken.co/get?type=talent&name=all"
    );

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("There was a problem with the fetch operation:", error);
  }
}

function calculateReqSum(reqs) {
  let sum = 0;

  if (reqs.base) {
    Object.values(reqs.base).forEach((value) => {
      sum += value;
    });
  }

  if (reqs.weapon) {
    Object.values(reqs.weapon).forEach((value) => {
      sum += value;
    });
  }

  if (reqs.attunement) {
    Object.values(reqs.attunement).forEach((value) => {
      sum += value;
    });
  }

  return sum;
}

function calculateCost(reqs) {
  let totalCost = 0;

  for (let stat in reqs.base) {
    totalCost += reqs.base[stat];
  }

  for (let weapon in reqs.weapon) {
    totalCost += reqs.weapon[weapon];
  }

  for (let attune in reqs.attunement) {
    totalCost += reqs.attunement[attune];
  }

  return totalCost;
}

function generateAllAttributes(talents) {
  const totalRequirements = {};
  const uniqueValues = {};

  // Loop through all talents and gather stats and unique values
  Object.keys(talents).forEach((key) => {
    const talent = talents[key];

    // Handle base requirements
    for (let stat in talent.reqs.base) {
      if (!totalRequirements.hasOwnProperty(stat)) {
        totalRequirements[stat] = 0; // Initialize to 0
        uniqueValues[stat] = new Set(); // Initialize with a Set to avoid duplicates
      }
      uniqueValues[stat].add(talent.reqs.base[stat]);
    }

    // Handle weapon requirements
    for (let weapon in talent.reqs.weapon) {
      if (!totalRequirements.hasOwnProperty(weapon)) {
        totalRequirements[weapon] = 0; // Initialize to 0
        uniqueValues[weapon] = new Set(); // Initialize with a Set to avoid duplicates
      }
      uniqueValues[weapon].add(talent.reqs.weapon[weapon]);
    }

    // Handle attunement requirements
    for (let attune in talent.reqs.attunement) {
      if (!totalRequirements.hasOwnProperty(attune)) {
        totalRequirements[attune] = 0; // Initialize to 0
        uniqueValues[attune] = new Set(); // Initialize with a Set to avoid duplicates
      }
      uniqueValues[attune].add(talent.reqs.attunement[attune]);
    }
  });

  // Convert Sets in `uniqueValues` to Arrays and sort them
  for (let stat in uniqueValues) {
    uniqueValues[stat] = Array.from(uniqueValues[stat]).sort((a, b) => a - b);
  }

  return { totalRequirements, uniqueValues };
}

function countSumReqs(reqs) {
  let sum = 0;
  for (let stat in reqs.base) {
    sum += reqs.base[stat];
  }
  for (let stat in reqs.attunement) {
    sum += reqs.attunement[stat];
  }
  for (let stat in reqs.weapon) {
    sum += reqs.weapon[stat];
  }
  return sum;
}

function checkIfTalentCanBeUnlocked(totalRequirements, reqs) {
  if (totalRequirements.length < 1) {
    return false;
  }
  let noValues = true;
  for (let stat in reqs.base) {
    noValues = false;
    if (totalRequirements[stat] < reqs.base[stat]) {
      return false;
    }
  }
  for (let stat in reqs.attunement) {
    noValues = false;
    if (totalRequirements[stat] < reqs.attunement[stat]) {
      return false;
    }
  }

  for (let stat in reqs.weapon) {
    noValues = false;
    if (totalRequirements[stat] < reqs.weapon[stat]) {
      return false;
    }
  }

  if (noValues == true) {
    return false;
  }
  return true; // All requirements are met
}

function printKeyValuePairsInline(object) {
  const entries = Object.entries(object);
  const formattedPairs = entries
    .map(([key, value]) => `${key}: ${value}`)
    .join(", ");
  console.log(formattedPairs);
}

let talentEntries;

// options/settings
const buildPrompt = ""//"gale aftercut galebreath wind suffocated wind";
const minimumStatUse = 1; // minimum a stat can be (FOR FASTER GENERATION)

function unlockTalents(unfiltered_talents) {
  
  const talents = Object.keys(unfiltered_talents)
  .filter((key) => countSumReqs(unfiltered_talents[key].reqs) > minimumStatUse) // Filter based on countSumReqs
  .reduce((acc, key) => {
    acc[key] = unfiltered_talents[key];
    return acc;
  }, {});
  
  const result = generateAllAttributes(talents);
  const myAttributes = result.totalRequirements;
  const uniqueValues = result.uniqueValues;

  for (let key in uniqueValues) {    
    // so generation tries out the bigger numbers first
    uniqueValues[key].reverse();
    
    // Keep only the values that are greater than 1
    //uniqueValues[key] = uniqueValues[key].filter(value => value > minimumStatUse); TODO FIX THIS
  }

  function preScoreAllTalents() {
    const talentScores = {};

    function calculateSimilarity(word1, word2) {
      return word1.toLowerCase() === word2.toLowerCase() ? 1 : 0;
    }

    for (let talentName in talents) {
      talentScores[talentName] = 1;
      /* just testing
      const desc = talents[talentName].desc.toLowerCase();

      const descWords = desc.split(/\s+/);
      const promptWords = buildPrompt.toLowerCase().split(/\s+/);

      // Initialize similarity score accumulator
      let similarityScore = 0;

      // compare each word in the prompt with each word in the description
      promptWords.forEach((promptWord) => {
        descWords.forEach((descWord) => {
          similarityScore += calculateSimilarity(promptWord, descWord);
        });
      });
      
      talentScores[talentName] += similarityScore*100;*/
    }

    return talentScores;
  }

  const talentScores = preScoreAllTalents();
  function scoreCombination(attempt) {
    // score the attempts
    let sumScore = 0;
    
    talentEntries.forEach((talent) => {
      const canUnlock = checkIfTalentCanBeUnlocked(attempt, talent.reqs);
      if (canUnlock) {
        sumScore += talentScores[talent.name];
      }
    });
    
    return sumScore;
  }

  const maxPoints = 60; //325;

  console.warn(myAttributes);
  const attributeKeys = Object.keys(myAttributes);
  const lastAttribute = attributeKeys.length;

  let bgigest = 0;
  const start = performance.now();
  let totalCombinations = 0;

  function generateCombinations(index,remainingPoints,currentCombination) { // index is the current attribute/stat attempted
    // Prune if remaining points are negative
    if (remainingPoints < 0) return;
    //console.log(index,lastAttribute,remainingPoints)
    
    if (index === lastAttribute) {
      if (remainingPoints === 0) {
        let currentScore = scoreCombination(currentCombination);
        if (currentScore > bgigest) {
          bgigest = currentScore;
          console.log("at",totalCombinations,"score:", currentScore);
          printKeyValuePairsInline(currentCombination);
        }
        totalCombinations++;
      }
      return; // leaf
    }
    
    const attributeKey = attributeKeys[index];
    const values = uniqueValues[attributeKey];

    for (let i = 0; i < values.length; i++) {
      const value = values[i];
      currentCombination[attributeKey] = value;
      generateCombinations(
        index + 1,
        remainingPoints - value,
        currentCombination,
      );
    }
  }

  const currentCombination = { ...myAttributes };
  generateCombinations(0, maxPoints, currentCombination);
  const end = performance.now();
  console.log(`Execution time: ${end - start} milliseconds`);
  console.log("Total Combinations: ", totalCombinations);
  console.warn("all possible stats of talents: ", uniqueValues);
}

const mainElement = document.querySelector("main");
async function main() {
  const talents = await fetchTalents(); // Wait for the promise to resolve

  Object.keys(talents).forEach((key) => {
    // so generation is 0.0001% faster
    if (key.toLowerCase() === "thank you") {
      delete talents[key];
    }
  });

  talentEntries = Object.keys(talents)
    .map((key) => ({
      name: key,
      reqs: talents[key].reqs,
    }))
    .filter((entry) => countSumReqs(entry.reqs) > minimumStatUse); // filter out if countSumReqs is 0 (FOR FASTER GENERATION)

  const sortedTalents = Object.keys(talents).sort((a, b) => {
    let sumA = calculateReqSum(talents[a].reqs) * 0.9;
    let sumB = calculateReqSum(talents[b].reqs) * 0.9;
    if (sumA == 0) {
      sumA = 20;
    }
    if (sumB == 0) {
      sumB = 20;
    }
    if (
      talents[a].desc.match(
        /\b(damage|resistance|buff|health|m1's)\b|\d+%|\d+/i
      )
    ) {
      sumA += 40;
    }
    if (
      talents[b].desc.match(
        /\b(damage|resistance|buff|health|m1's)\b|\d+%|\d+/i
      )
    ) {
      sumB += 40;
    }
    if (
      talents[a].desc.match(
        /\b(m1's|break|breaking|less damage|more damage|basic attack|rolling|feast)\b/i
      )
    ) {
      sumA += 40;
    }
    if (
      talents[b].desc.match(
        /\b(m1's|break|breaking|less damage|more damage|basic attack|rolling|feast)\b/i
      )
    ) {
      sumB += 40;
    }
    const talentALower = talents[a].name.toLowerCase();
    const talentBlower = talents[b].name.toLowerCase();
    if (
      talentALower.includes("ether overdrive") ||
      talentALower.includes("adept") ||
      talentALower.includes("expert") ||
      /master\s/.test(talentALower)
    ) {
      sumA -= 100;
    }
    if (
      talentBlower.includes("ether overdrive") ||
      talentBlower.includes("adept") ||
      talentBlower.includes("expert") ||
      /master\s/.test(talentBlower)
    ) {
      sumB -= 100;
    }
    if (talentALower.includes("unbounded")) {
      sumA -= 100;
    }
    if (talentBlower.includes("unbounded")) {
      sumB -= 100;
    }
    if (talents[a].name == "Umami") {
      sumA += 60;
    }
    if (talents[b].name == "Umami") {
      sumB += 60;
    }
    return sumB - sumA;
  });

  sortedTalents.forEach((key) => {
    const entry = talents[key];
    const container = document.createElement("div");
    container.classList.add("entry");

    // Title (name)
    const nameElement = document.createElement("h2");
    nameElement.textContent = entry.name;

    const header = document.createElement("div");
    header.classList.add("entry-header");
    header.appendChild(nameElement);

    if (entry.category) {
      const categoryElement = document.createElement("span"); // Use span for inline element
      categoryElement.textContent = `${entry.category}`;
      header.appendChild(categoryElement);
    }

    container.appendChild(header);

    if (entry.desc) {
      const descElement = document.createElement("p");
      descElement.textContent = `${entry.desc}`;
      container.appendChild(descElement);
    }

    if (entry.rarity) {
      const rarityElement = document.createElement("p");
      rarityElement.textContent = `${entry.rarity} Talent`;
      container.appendChild(rarityElement);
    }

    if (entry.reqs.from) {
      const fromElm = document.createElement("p");
      fromElm.textContent = `from: ${entry.reqs.from}`;
      container.appendChild(fromElm);
    }

    if (entry.stats != "N/A") {
      const statsElm = document.createElement("p");
      statsElm.textContent = `${entry.stats}`;
      container.appendChild(statsElm);
    }

    let reqsText = "";

    if (entry.reqs.base) {
      Object.keys(entry.reqs.base).forEach((stat) => {
        if (entry.reqs.base[stat] > 0) {
          reqsText += `${entry.reqs.base[stat]} ${stat},  `;
        }
      });
    }

    if (entry.reqs.weapon) {
      Object.keys(entry.reqs.weapon).forEach((weapon) => {
        if (entry.reqs.weapon[weapon] > 0) {
          reqsText += `${entry.reqs.weapon[weapon]} ${weapon},  `;
        }
      });
    }

    if (entry.reqs.attunement) {
      Object.keys(entry.reqs.attunement).forEach((attune) => {
        if (entry.reqs.attunement[attune] > 0) {
          reqsText += `${entry.reqs.attunement[attune]} ${attune},  `;
        }
      });
    }

    const footer = document.createElement("div");

    //console.log(entry)

    if (reqsText) {
      footer.classList.add("entry-footer");
      const reqsElement = document.createElement("p");
      reqsElement.textContent = `${reqsText}`;
      footer.appendChild(reqsElement);
      container.appendChild(footer);
    }

    if (entry.exclusiveWith.length > 1 || entry.exclusiveWith[0] !== "") {
      footer.classList.add("entry-footer");

      const dropdownButton = document.createElement("button");
      dropdownButton.textContent = "Show Mutual Exclusives";
      dropdownButton.classList.add("dropdown-button");

      const exclusivesList = document.createElement("ul");
      exclusivesList.classList.add("exclusive-list");
      exclusivesList.style.display = "none"; // Initially hidden

      entry.exclusiveWith.forEach((exclusive) => {
        const listItem = document.createElement("li");
        listItem.textContent = exclusive;
        exclusivesList.appendChild(listItem);
      });

      dropdownButton.addEventListener("click", () => {
        const isHidden = exclusivesList.style.display === "none";
        exclusivesList.style.display = isHidden ? "block" : "none";
        dropdownButton.textContent = isHidden
          ? "Hide Mutual Exclusives"
          : "Show Mutual Exclusives";
      });

      footer.appendChild(dropdownButton);
      footer.appendChild(exclusivesList);
      container.appendChild(footer);
    }

    console.log(key);
    mainElement.appendChild(container);
  });

  //unlockTalents(talents);
}

main();
