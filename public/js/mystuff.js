var textBox2 = document.querySelector('.text-box2');

function make(text, url, description) {
  return `
    <div class="line">
      <a href="${url}" class="link" target="_blank">${text}</a>
      <p class="desc">${description}</p>
    </div>
  `;
}

var text =`${make(
  "Connect 4 AI", 
  "/c4",
  "a customizable connect4 grid with ai"
)}

${make(
  "Coin Sorter",
  "/change",
  "week1 - challenge from frostwolf (from SAIT prog club)"
)}

${make(
  "Journal Web App",
  "/journal",
  "week4 - challenge from saladstik (from SAIT prog club)"
)}
`;

textBox2.innerHTML = text;