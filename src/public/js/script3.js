var textBox2 = document.querySelector(".text-box2");

function col(txt, col) {
  return `<span style="color: ${col};">` + txt + `</span>`;
}

function link(text, url, color) {
  return `<a href="${url}" target="_blank" style="color: ${color};">${text}</a>`;
}

var text = `public email: <span class="selectable">aizryalt@gmail.com</span>
github: <span class="selectable">${link(
    "https://github.com/Air-zy",
    "https://github.com/Air-zy",
    "lightblue"
  )}</span>
  
  
`;

textBox2.innerHTML = text + `${col(`loading the captcha`, "gray")}
  ${col(`resfresh if it does not load`, "gray")}`;

let gottenCaptcha = {
  txt: "???",
  id: 0,
  hash: "???"
};

async function genCaptcha() {
  try {
    const bodyString = JSON.stringify({ data: "gimme captcha lol" });
    const resp = await fetch("/api/makecaptcha", {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: bodyString,
    });
    if (!resp.ok) {
      throw new Error("resp not ok code: " + resp.status);
    }
    const responseJson = await resp.json();
    gottenCaptcha = {
      txt: responseJson.txt,
      id: responseJson.id,
      hash: responseJson.hash
    };
    console.log(gottenCaptcha);

    textBox2.innerHTML = text + `
  ${col(`enter the opposite of "`, "gray")}${responseJson.txt}${col(`" for more`, "gray")}  <a style="color: grey; font-size: 0.8em; href="#" onclick="alert('small captcha to try to hide from crawlers'); return false;">ⓘ</a>
  <input type="text" id="secretInput" onkeypress="handleKeyPress(event)"> <button onclick="checkSecret()">Submit</button>
  `;
  } catch (err) {
    // Handle errors here
    textBox2.innerHTML = text + `  ${col(`captcha failed to load... please refresh`, "gray")}
      ${col(`${err}`, "gray")}`;
    console.error("Error:", err);
  }
}
genCaptcha();

async function verifyCaptcha(answer) {
  try {
    const resp = await fetch("/api/verifycaptcha", {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        data: {
          id: gottenCaptcha.id,
          answer: answer,
          hash: gottenCaptcha.hash
        },
      }),
    });

    if (!resp.ok) {
      const errorText = await resp.text();
      genCaptcha();
      throw new Error(errorText);
    }

    const respText = await resp.text();
    textBox2.innerHTML = text + respText;
  } catch (err) {
    alert(err);
  }
}

function checkSecret() {
  var userInput = document.getElementById("secretInput").value.toLowerCase();
  verifyCaptcha(userInput);
}

function handleKeyPress(event) {
  if (event.key === "Enter") {
    checkSecret();
  }
}