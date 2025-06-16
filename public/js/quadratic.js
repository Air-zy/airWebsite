function adjustWidth(input) {
  const content = input.value || input.placeholder;
  input.style.width = content.length + "ch";
}

let coefficients;
let a = 0;
let b = 0;
let c = 0;

function updateCofs() {
  coefficients.textContent = `a = ${a} b = ${b} c = ${c}`;
}

function handleBlur(event) {
  const input = event.target;
  let value = input.value.trim();

  if (input.placeholder !== "a") {
    if (/^\-\d/.test(value)) {
      value = value.replace(/^\-(\d)/, "- $1");
    }

    if (/^\+\d/.test(value)) {
      value = value.replace(/^\+(\d)/, "+ $1");
    }

    if (!/^(\+ |\- )/.test(value)) {
      const parsedNumber = parseFloat(value);
      if (!isNaN(parsedNumber)) {
        value = `+ ${parsedNumber}`;
      }
    }

    input.value = value;
    adjustWidth(input);

    if (input.placeholder == "+ c") {
      c = parseFloat(value.replace(/ /g, ""));
    } else {
      b = parseFloat(value.replace(/ /g, ""));
    }
    updateCofs();
  } else {
    a = parseFloat(value);
    updateCofs();
  }
  
  renderQuadraticFormula();
}

function appendNewFormula(container, formula) {
  const newDiv = document.createElement("div");
  newDiv.className = "line";
  newDiv.innerHTML = formula;
  MathJax.Hub.Queue(["Typeset", MathJax.Hub, newDiv]);
  container.appendChild(newDiv);
}


function appendLine(container, innerHtml) {
  const newDiv = document.createElement("div");
  newDiv.className = "line";
  newDiv.innerHTML = innerHtml;
  container.appendChild(newDiv);
}

function setRounding(number) {
  return Math.round(number * 10000) / 10000;
}

function renderQuadraticFormula() {
  const container = document.getElementById("container");

  // clear
  const existingLines = container.getElementsByClassName("line");
  while (existingLines.length > 0) {
    existingLines[0].parentNode.removeChild(existingLines[0]);
  }
  
  let theFirstGuy = b
  if (b < 0) {
    theFirstGuy = "("+b+")"
  }
  const formula = "\\[ x = \\frac{-" + theFirstGuy +" \\pm \\sqrt{(" + b +")^2 - 4(" + a +")(" + c +")}}{2(" + a +")} \\]";
  appendNewFormula(container, formula)
  
  // multiplies
  
  const formula2 = "\\[ x = \\frac{-" + theFirstGuy +" \\pm \\sqrt{" + b**2 +" - 4(" + a*c + ")}}{" + 2*a +"} \\]";
  appendNewFormula(container, formula2)
  
  // simplified
  
  let toRoot = b**2 - 4*(a*c)// b^2 - fourac
  if (theFirstGuy > 0) {
    theFirstGuy = -theFirstGuy
  }
  const formula3 = "\\[ x = \\frac{" + theFirstGuy +" \\pm \\sqrt{" + toRoot + "}}{" + 2*a +"} \\]";
  appendNewFormula(container, formula3)
  
  if (toRoot < 0) {
    appendLine(container, "Negative square root Error")
    return;
  }
  
  // root
  
  const theRoot = Math.sqrt(toRoot);
  const formula4 = "\\[ x = \\frac{" + theFirstGuy +" \\pm "+setRounding(theRoot)+"}{" + 2*a +"} \\]";
  appendNewFormula(container, formula4)
  
  // plus
  const pform = "\\[ x_1 = \\frac{" + setRounding(-b+theRoot) + "}{" + 2*a +"} \\]";
  appendNewFormula(container, pform)
  
  // minus
  const mform = "\\[ x_2 = \\frac{" + setRounding(-b-theRoot) + "}{" + 2*a +"} \\]";
  appendNewFormula(container, mform)
  
  if ((2*a) != 0) { // zero denominator
    // plus2
    const pform2 = "\\[ x_1 = " + setRounding(-b+theRoot)/(2*a) + "\\]";
    appendNewFormula(container, pform2)

    // minus2
    const mform2 = "\\[ x_2 = " + setRounding(-b-theRoot)/(2*a) + "\\]";
    appendNewFormula(container, mform2)
  } else {
    appendLine(container, "Over Zero Error")
  }
}

document.addEventListener("DOMContentLoaded", function () {
  coefficients = document.getElementById("coefficients");
  const inputs = document.querySelectorAll('input[type="text"]');
  
  renderQuadraticFormula();
  
  inputs.forEach(function (input) {
    adjustWidth(input);
    input.addEventListener("input", function () {
      adjustWidth(this);
    });
    input.addEventListener("blur", handleBlur);
  });
});
