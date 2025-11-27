class baseReqs{
  constructor(data) {
    this.Body         = data.Body || 0;
    this.Mind         = data.Mind || 0;

    this.Agility      = data.Agility || 0;
    this.Willpower    = data.Willpower || 0;
    this.Charisma     = data.Charisma || 0;
    this.Fortitude    = data.Fortitude || 0;
    this.Intelligence = data.Intelligence || 0;
    this.Strength     = data.Strength || 0
  }
}

class wepReqs {
  constructor(data) {
    this.Heavy  = data["Heavy Wep."] || 0;
    this.Medium = data["Medium Wep."] || 0;
    this.Light  = data["Light Wep."] || 0;
  }
}

class attunementReqs {
  constructor(data) {
    this.Bloodrend   = data.Bloodrend || 0;
    this.Flamecharm  = data.Flamecharm || 0;
    this.Frostdraw   = data.Frostdraw || 0;
    this.Galebreathe = data.Galebreathe || 0;
    this.Ironsing    = data.Ironsing || 0;
    this.Shadowcast  = data.Shadowcast || 0;
    this.Thundercall = data.Thundercall || 0;
  }
}

class Character {
  constructor() {
    this.power      = 0
    this.weaponType = ""
    this.base       = new baseReqs({})
    this.weapon     = new wepReqs({})
    this.attunement = new attunementReqs({})

    this.cards = [];
  }

  addCard(card) {
    if (card.meetsReqs(this) == false) {
      return false
    }

    this.cards.push(card);
    return true
  }
}

class Card {
  constructor(key, data) {
    this.key      = key;
    this.name     = String(data.name);
    this.desc     = String(data.desc);
    this.rarity   = String(data.rarity);
    this.category = String(data.category);

    this.reqs = {
      power:      Number(data.reqs.power),
      weaponType: data.reqs.weaponType == "None" ? null : String(data.reqs.weaponType),
      from:       data.reqs.weaponType == "" ? null : String(data.reqs.from),
      base:       new baseReqs(data.reqs.base),
      weapon:     new wepReqs(data.reqs.weapon),
      attunement: new attunementReqs(data.reqs.attunement)
    };

    this.exclusiveWith = data.exclusiveWith || [];
    this.stats = data.stats == "" || data.stats == "N/A" ? null : data.stats
      .split(",")
      .map(s => s.trim())
      .filter(Boolean);

    this.dontCountTowardsTotal = Boolean(data.dontCountTowardsTotal);
    this.vaulted               = Boolean(data.vaulted);
  }

  meetsReqs(char) {
    if (char.power < this.reqs.power) {
      return false;
    }

    /*
    if (this.reqs.weaponType && char.weaponType !== this.reqs.weaponType)
      return false;

    if (this.reqs.from && this.reqs.from !== "" && this.reqs.from !== char.from)
      return false;
    */

    // base stats
    for (const stat in this.reqs.base) {
      if (char.base[stat] < this.reqs.base[stat]) return false;
    }

    // wep stats
    for (const stat in this.reqs.weapon) {
      if (char.weapon[stat] < this.reqs.weapon[stat]) return false;
    }

    // attunment stats
    for (const stat in this.reqs.attunement) {
      if (char.attunement[stat] < this.reqs.attunement[stat]) return false;
    }

    return true;
  }

  sumReqPoints() {
    let total = 0;

    // Base
    const base = this.reqs.base || {};
    for (const key in base) {
      const value = Number(base[key]);
      if (value > 0) total += value;
    }

    // Weapon
    const weapon = this.reqs.weapon || {};
    for (const key in weapon) {
      const value = Number(weapon[key]);
      if (value > 0) total += value;
    }

    // Attunement
    const attune = this.reqs.attunement || {};
    for (const key in attune) {
      const value = Number(attune[key]);
      if (value > 0) total += value;
    }

    return total;
  }

  toDiv() {
    const div = document.createElement("div");
    div.className = "card";

    const makeTag = (text, extraClass = "") => `<span class="tag ${extraClass}">${text}</span>`;

    // general simple reqs
    const simpleReqs = [];
    if (this.reqs.power > 0) simpleReqs.push(makeTag(`power >= ${this.reqs.power}`, "req-power"));
    if (this.reqs.weaponType) simpleReqs.push(makeTag(this.reqs.weaponType, "req-wepType"));

    // base req tags (only > 0)
    const baseTags = Object.entries(this.reqs.base || {})
      .filter(([, v]) => Number(v) > 0)
      .map(([k, v]) => makeTag(`${v} ${k}`, "req-base"));

    // weapon req tags (only > 0)
    const weaponTags = Object.entries(this.reqs.weapon || {})
      .filter(([, v]) => Number(v) > 0)
      .map(([k, v]) => makeTag(`${v} ${k}`, "req-weapon"));

    // attunement req tags (only > 0)
    const attuneTags = Object.entries(this.reqs.attunement || {})
      .filter(([, v]) => Number(v) > 0)
      .map(([k, v]) => makeTag(`${v} ${k}`, "req-attune"));

    // stats tags
    const statTags = (this.stats || []).map(s => makeTag(s, "stat"));

    // combine everything into req HTML if any exists
    const allReqTags = [...simpleReqs, ...baseTags, ...weaponTags, ...attuneTags];
    const reqHTML = allReqTags.length
      ? `<div class="reqs">${allReqTags.join(" ")}</div>`
      : "";

    const statsHTML = statTags.length
      ? `<div class="stats">${statTags.join(" ")}</div>`
      : "";

    const exclHTML = (this.exclusiveWith && this.exclusiveWith.length > 0 && this.exclusiveWith[0] != "")
      ? `<div class="exclusive">Exclusive with: ${this.exclusiveWith.map(e => `<span class="excl">${e}</span>`).join(" ")}</div>`
      : "";

    if (this.reqs.from) {
      statTags.push(makeTag("from: " + this.reqs.from, "stat"));
    }

    div.innerHTML = `
      <h2>${this.name}</h2>
      <small>${this.category} - ${this.rarity}</small>
      <p>${this.desc}</p>

      ${reqHTML}
      ${statsHTML}
      ${exclHTML}
      ${this.reqs.from ? `<p class="stat">from: ${this.reqs.from}</p>` : ""}
    `;
    return div;
  }
}

export { Card, wepReqs, baseReqs, attunementReqs, Character };