let denoms = [
  ["$2", 200],
  ["$1", 100],
  ["50¢", 50],
  ["25¢", 25],
  ["5¢", 5],
  ["1¢", 1],
];

function sortDenoms() {
  denoms.sort((a, b) => b[1] - a[1]);
}

function setCursorToEnd(input) {
  console.log(input.value)
  input.focus();
}

function getCoins(amt) {
  let cents = Math.round(amt * 100);
  const result = {};
  for (const [name, value] of denoms) {
    // for each denom
    if (cents >= value) {
      // make sure we still got cash for this denom
      result[name] = Math.floor(cents / value);
      cents %= value; // update left duh
    }
  }

  return result;
}

const maxEmojisPerLine = 128;

document.addEventListener("DOMContentLoaded", function () {
  const inputElem = document.getElementById("input");
  const container = document.getElementById("container");
  const delimsElem = document.getElementById("delims");
  let lastValue = 0; 
  
  function updateDisplay() {
    console.warn(denoms)
    let lineDivs = Array.from(delimsElem.getElementsByClassName("line"));
    lineDivs.forEach((lineDiv, index) => {
      if (index < denoms.length) {
        const [name, value] = denoms[index];
        const valueInput = lineDiv.querySelector(".changeValue");
        if (valueInput) {
          valueInput.value = value / 100;
          
          if (lastValue === value) {
            setCursorToEnd(valueInput);
          }
        }
      } else {
        delimsElem.removeChild(lineDiv);
      }
    });

    for (let i = lineDivs.length; i < denoms.length; i++) {
      const [name, value] = denoms[i];
      const lineDiv = document.createElement("div");
      lineDiv.className = "line";

      const input2 = document.createElement("input");
      input2.className = "changeValue";
      input2.id = "input";
      input2.type = "number";
      input2.min = "0";
      input2.max = "2000";
      input2.step = "0.01";
      input2.value = value / 100;
      input2.placeholder = "???";

      input2.addEventListener("input", (event) => {
        const newValue = parseFloat(event.target.value) * 100;
        if (newValue && value !== newValue) {
          denoms[i][1] = newValue;
          if (newValue >= 100) {
            denoms[i][0] = "$" + newValue/100;
          } else {
            denoms[i][0] = newValue + "¢";
          }
          lastValue = newValue;
          sortDenoms();
          updateDisplay();
        }
      });

      const deleteButton = document.createElement("button");
      deleteButton.textContent = "X";
      deleteButton.className = "deleteButton";
      deleteButton.addEventListener("click", () => {
        denoms = denoms.filter(([_, num]) => num !== value);
        lineDiv.remove();
        sortDenoms();
        updateDisplay();
      });
      
      lineDiv.appendChild(input2);
      lineDiv.appendChild(deleteButton);
      delimsElem.appendChild(lineDiv);
    }
    const elementToRemove = document.getElementById("addValue");
    if (elementToRemove) {
        elementToRemove.remove();
    }
    
    const addValueDiv = document.createElement("div");
    addValueDiv.id = "addValue";
    addValueDiv.textContent = "+";
    addValueDiv.addEventListener("click", () => {
       denoms.push(['?', 0]);
       sortDenoms(); 
       updateDisplay();
    });
    delimsElem.appendChild(addValueDiv);
  }

  updateDisplay();
  
  inputElem.addEventListener("input", function () {
    const initInputVal = inputElem.value;
    const rounded = Math.round(initInputVal * 100) / 100;
    if (initInputVal != rounded) {
      inputElem.value = rounded;
    }
    if (initInputVal < 0) {
      inputElem.value = 0.01;
    }

    const amt = parseFloat(inputElem.value);
    const coins = getCoins(amt);

    // clear
    const existingLines = container.getElementsByClassName("line");
    while (existingLines.length > 0) {
      existingLines[0].parentNode.removeChild(existingLines[0]);
    }

    Object.entries(coins).forEach(([name, count]) => {
      console.log(`${name}: ${count}`);
      const lineDiv = document.createElement("div");
      lineDiv.className = "line";

      const label = document.createElement("label");
      label.innerHTML = `${name} <span style="font-size: 0.8em; color: grey;">(${count})</span>: `;

      let extra = 0;
      if (count > maxEmojisPerLine) {
        extra = count - maxEmojisPerLine;
        count = maxEmojisPerLine;
      }
      for (let i = 0; i < count; ++i) {
        label.innerHTML += "O ";
      }
      if (extra > 0) {
        label.innerHTML += `<span style="font-size: 0.8em; color: grey;">+${extra}</span>`;
      }

      lineDiv.appendChild(label);
      container.appendChild(lineDiv);
    });
  });
  
});
