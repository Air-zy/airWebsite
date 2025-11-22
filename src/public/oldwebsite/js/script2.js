function lerp(start, end, t) {
  return start + t * (end - start);
}

const canvas = document.getElementById("skillsDiagram");
const ctx = canvas.getContext("2d");

const knowledge = { // how much i know
  0: {
    "SQL": 0,
    "HTML": 0,
    "C++": 0,
    "Java": 0,
    "JavaScript": 0,
    "Python": 0,
    "C#/C": 0.1,
    "Luau": 2,
    "Age": 12,
  },
  10: {
    "SQL": 0,
    "HTML": 0,
    "C++": 0,
    "Java": 0,
    "JavaScript": 1,
    "Python": 1,
    "C#/C": 1,
    "Luau": 3,
    "Age": 13,
  },
  30: {
    "SQL": 0,
    "HTML": 0,
    "C++": 0,
    "Java": 1,
    "JavaScript": 2.5,
    "Python": 1.5,
    "C#/C": 1.5,
    "Luau": 5,
    "Age": 14,
  },
  45: {
    "SQL": 0,
    "HTML": 0,
    "C++": 0,
    "Java": 1,
    "JavaScript": 3,
    "Python": 2,
    "C#/C": 1.5,
    "Luau": 5,
    "Age": 15,
  },
  60: {
    "SQL": 0,
    "HTML": 0,
    "C++": 3,
    "Java": 1,
    "JavaScript": 3.5,
    "Python": 3,
    "C#/C": 2.5,
    "Luau": 9,
    "Age": 16,
  },
  80: {
    "SQL": 0,
    "HTML": 3,
    "C++": 5,
    "Java": 2,
    "JavaScript": 4,
    "Python": 3.5,
    "C#/C": 3,
    "Luau": 9,
    "Age": 17,
  },
  100: {
    "SQL": 1,
    "HTML": 3.5,
    "C++": 7,
    "Java": 2,
    "JavaScript": 4.5,
    "Python": 4,
    "C#/C": 3,
    "Luau": 9,
    "Age": 18,
  }
};

const skills = { // ease of use
  0: {
    "SQL": 0,
    "HTML": 0,
    "C++": 0,
    "Java": 0,
    "JavaScript": 0,
    "Python": 0,
    "C#/C": 0.1,
    "Luau": 5,
  },
  10: {
    "SQL": 0,
    "HTML": 0,
    "C++": 0,
    "Java": 0,
    "JavaScript": 1.5,
    "Python": 1.5,
    "C#/C": 1,
    "Luau": 7,
  },
  30: {
    "SQL": 0,
    "HTML": 0,
    "C++": 0,
    "Java": 2,
    "JavaScript": 3,
    "Python": 3,
    "C#/C": 2,
    "Luau": 9,
  },
  45: {
    "SQL": 0,
    "HTML": 0,
    "C++": 0,
    "Java": 2,
    "JavaScript": 4,
    "Python": 4,
    "C#/C": 2,
    "Luau": 9,
  },
  60: {
    "SQL": 0,
    "HTML": 0,
    "C++": 3,
    "Java": 2,
    "JavaScript": 5,
    "Python": 5,
    "C#/C": 2.5,
    "Luau": 9,
  },
  80: {
    "SQL": 0,
    "HTML": 4,
    "C++": 5,
    "Java": 2.5,
    "JavaScript": 5.5,
    "Python": 5.5,
    "C#/C": 4,
    "Luau": 9,
  },
  100: {
    "SQL": 2,
    "HTML": 5,
    "C++": 7,
    "Java": 3,
    "JavaScript": 6,
    "Python": 6,
    "C#/C": 4,
    "Luau": 9,
  },
};

function interpolateData(sliderVal, data) {
  const sortedKeys = Object.keys(data).map(Number).sort((a, b) => a - b);

  // Find the closest points surrounding sliderVal
  let lowerKey = sortedKeys[0];
  let upperKey = sortedKeys[0];

  for (let i = 0; i < sortedKeys.length; i++) {
    if (sliderVal < sortedKeys[i]) {
      upperKey = sortedKeys[i];
      lowerKey = i > 0 ? sortedKeys[i - 1] : sortedKeys[i];
      break;
    }
    upperKey = sortedKeys[i];
  }

  // Get the values at the surrounding points
  const valuesAtPoints = {
    lower: data[lowerKey],
    upper: data[upperKey]
  };

  // Calculate the interpolation factor
  const t = (sliderVal - lowerKey) / (upperKey - lowerKey);

  // Interpolate the data
  const interpolatedData = {};
  for (const [lang, valueAtLower] of Object.entries(valuesAtPoints.lower)) {
    const valueAtUpper = valuesAtPoints.upper[lang];
    const lerpValue = lerp(valueAtLower, valueAtUpper, t);
    if (lerpValue > 0) {
      interpolatedData[lang] = lerpValue
    }
  }

  return interpolatedData;
}

canvas.width = 400;
canvas.height = 400;

const centerX = canvas.width / 2 - 20;
const centerY = canvas.height / 2;
let radius = Math.min(canvas.width, canvas.height);

function nearesetTenth(v) {
  return Math.floor(v*10)/10;
}

function extraAngle(v) {
  if (v == 0) {
    return Math.PI/2;
  }
  return 0
  //return Math.PI/(1+v/100) + 2;
}

function drawSpiderweb(sliderVal) {
  const interpskills = interpolateData(sliderVal, skills)
  const interpKnowlg = interpolateData(sliderVal, knowledge)
  const skillLevels = Object.values(interpskills); // dificulty
  const skillKnowledge = Object.values(interpKnowlg); // knowledge
  const languages = Object.keys(interpskills); // Language names
  const maxLevel = Math.max(...skillLevels);
  
  const age = nearesetTenth(interpKnowlg["Age"]);
  const numLangs = skillLevels.length
  
  ctx.clearRect(0, 0, canvas.width, canvas.height); // clear

  // set stroke style to white
  ctx.strokeStyle = "#414141"; // grey
  ctx.fillStyle = "#ffffff"; // white color
  ctx.textAlign = "center";
  ctx.font = "20px Consolas";


  ctx.font = "12px Courier New";
  ctx.textAlign = "left";

  for (let j = 0; j < 10; j++) {
    ctx.beginPath();
    const outsideLinesNum = Math.max(numLangs, 2)
    for (let i = 0; i < outsideLinesNum; i++) {
      radius = (Math.min(canvas.width, canvas.height) * 9) / 25 - j * (canvas.width / 25);
      const angle = (Math.PI * 2 * i) / outsideLinesNum + extraAngle(sliderVal);
      const x = centerX + radius * Math.cos(angle);
      const y = centerY + radius * Math.sin(angle);
      
      ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();
  }

  ctx.strokeStyle = "#ffffff"; // white color
  ctx.beginPath();
  for (let i = 0; i < numLangs; i++) {
    radius = (Math.min(canvas.width, canvas.height) * skillLevels[i]) / 25;
    const angle = (Math.PI * 2 * i) / numLangs + extraAngle(sliderVal);
    const x = centerX + radius * Math.cos(angle);
    const y = centerY + radius * Math.sin(angle);
    ctx.lineTo(x, y);


    // text labels
    const labelX = centerX - 10 + (Math.min(canvas.width, canvas.height) / 3 + 30) * Math.cos(angle); // Adjust distance from center based on skill level
    const labelY = centerY + 5 + (Math.min(canvas.width, canvas.height) / 3 + 20) * Math.sin(angle); // Adjust distance from center based on skill level
    ctx.fillText(languages[i], labelX, labelY);
  }
  ctx.closePath();
  ctx.stroke();

  ctx.strokeStyle = "#acc0f3";
  ctx.beginPath();
  for (let i = 0; i < numLangs; i++) {
    radius = (Math.min(canvas.width, canvas.height) * skillKnowledge[i]) / 25;
    const angle = (Math.PI * 2 * i) / numLangs + extraAngle(sliderVal);
    const x = centerX + radius * Math.cos(angle);
    const y = centerY + radius * Math.sin(angle);
    ctx.lineTo(x, y);
  }

  ctx.closePath();
  ctx.stroke();

  //ctx.strokeStyle = "#414141"; // grey
  ctx.fillStyle = "#ffffff"; // white color
  ctx.textAlign = "center";
  ctx.font = "20px Consolas";
  ctx.fillText("Expertise ", centerX, 20);
  
  ctx.closePath();
  ctx.stroke();

  ctx.strokeStyle = "#414141"; // grey
  ctx.fillStyle = "#ffffff"; // white color
  ctx.textAlign = "center";
  ctx.font = "14px Consolas";
  ctx.fillText("age " + age, centerX + sliderVal*2 - 100, 390);
}

//

var textBox = document.querySelector(".text-box");
var textBox2 = document.querySelector(".text-box2");

textBox.textContent = `function life(airzy, τ):
  if τ > 36525:
    return
  
  airzy.optimize()
  if airzy.energy > 0:
    airzy.code()
  else:
    airzy.sleep(28800)
    
  life(airzy, τ+1)
  
airzy = human()
life(airzy, 0)
`;

function col(txt, col) {
  return `<span style="color: ${col};">` + txt + `</span>`;
}

function link(text, url, color) {
  return `<a href="${url}" target="_blank" style="color: ${color};">${text}</a>`;
}

var text = `${col("-  Me  -", "gray")}

  I am Airzy...
  A skilled ${col("programmer", "#fff091")} & ${col(
  "developer",
  "#fff091"
)} originally from the philippines...
  I am fluent in a plethora of programming languages and bilingual in
  both English and Tagalog/Ilocano.
  I aim to be the best
  
  Started all the way back in ${col(
    "grade 7 in 2018",
    "#d19b8a"
  )} with a ${link(
  "roblox game",
  "https://www.roblox.com/games/1355327143",
  "lightblue"
)}
  With my limited skill back then, I did my best to give my games a spin.  
  
  ${col("-  ROBLOX Rise to 90k visits & 200+ games  -", "gray")}
  
  Made a critical decision to spend my free time into making more fun games...
  grade 7 to 9, self taught myself lua & a bit of ${col(
    "C#",
    "#fff091"
  )} to try out unity...
  kept improoving in roblox, as the multiplayer was my biggest motivation...
  ${col(
    "lua/rblx",
    "#fff091"
  )} made me to learn Coding Fundementals, Network Systems, OOP, ect...
                                                                                                               ${link(
                                                                                                                 "more",
                                                                                                                 "r",
                                                                                                                 "grey"
                                                                                                               )}
                                                                                                               
  ${col("-  Web Technologies  -", "gray")}
  
  grade 9, Created a ${link(
    "Discord Bot",
    "https://top.gg/bot/1128119096848953344",
    "lightblue"
  )} chatbot...
  previously using old ${link(
    "chai",
    "https://www.chai-research.com",
    "white"
  )} developer api. but now using ${link(
    "openai",
    "https://openai.com/",
    "white"
  )} gpt models...
  the bot was previously hosted online using IDE's like replit. It is mostly written in JavaScript 
  and uses the libraries axios and node-fetch for making HTTP requests to the APIs..
  
  
  ${col("-  Highschool  -", "gray")}
  
  Graduated from ${link(
    "Holy Trinity Academy",
    "https://holytrinity.redeemer.ab.ca",
    "#56b27e"
  )}
  Top of my class for Computer Programming
  Contributed to my school by making
  a ${link(
    "c++ program",
    "https://github.com/Air-zy/staffStudentPairing",
    "lightblue"
  )} to aid in our graduation.
  Mastered all c++ Linear Data Structures, Recursion...
  Proficient in Algorithms, Complexity, Hash Tables...
  
  
  ${col("-  Media  -", "gray")}
 
  
`;

textBox2.innerHTML = text;
document.addEventListener("DOMContentLoaded", function () {
  const slider = document.getElementById("skillsSlider");
  function updateSliderValue() {
    drawSpiderweb(slider.value);
  }
  updateSliderValue();
  slider.addEventListener("input", updateSliderValue);
});
