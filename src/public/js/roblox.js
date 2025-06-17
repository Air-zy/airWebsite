var textBox2 = document.querySelector('.text-box2');

function col(txt,col) {
  return `<span style="color: ${col};">` + txt +`</span>`
}

function link(text, url, color) {
  return `<a href="${url}" target="_blank" style="color: ${color};">${text}</a>`;
}

var text =
`  ${col("-  Roblox  -", "gray")}
  
  Roblox Account: ${link(
  "https://www.roblox.com/users/498605109",
  "https://www.roblox.com/users/498605109",
  "lightblue"
)}

  I learnt how to code and make games in roblox via documentations
  The Toolbox is a feature roblox has that let the community share creations but its criticized due to low quality and 0 originality
  No matter i used it pretty frequently...
`;

textBox2.innerHTML = text;