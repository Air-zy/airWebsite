function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getRandomUint32() {
    return Math.floor(Math.random() * (2 ** 32)) >>> 0;
}

const tokenColYellow = "#ffff01";
const tokenColRed = "#e20004";
const dropSpeed = 200;

let visualToken;
let visualTokenText;
let selectedCol;

import {
  transTable,
  moveStack,
  cols,
  rows,
  connectIn,
  redIsAI,
  yelIsAI,
  setRedIsAI,
  setYelIsAI,
  turn,
  gameState,
  tokenGrid,
  tokenGridHeights,
  setCol,
  setRow,
  setConnectIn,
  resetGame,
  rawDrop,
  rawUndrop,
  genValidDrops,
  minmax,
  myHuge, // number for win
  myHuge2, // number for semi win
  nodes, // minimax nodes
  resetNodes,
  IntStack,
} from './modules/c4main.js';

const redoStack = new IntStack();
let aiThinkTime = 800;

let lastDrop = 1;
let miniMaxIsProccesing = false;

// visual
let tokenOffseter = 0.0;
function tokenVisual(cellDIV, bcol, cellDIV2) {
  const vtoken = document.createElement("div");
  const cellRect = cellDIV.getBoundingClientRect();
  vtoken.style.position = "absolute";
  if (cellDIV2) {
    vtoken.style.top = cellRect.top - cellRect.height / 2 + "px";
  } else {
    vtoken.style.top = cellRect.top + cellRect.height / 2 + "px";
  }
  vtoken.style.left = cellRect.left + cellRect.width / 2 + "px";
  vtoken.style.width = cellRect.width * 0.8 + "px"; // 80% of cell
  vtoken.style.height = cellRect.height * 0.8 + "px";
  vtoken.style.backgroundColor = bcol;
  vtoken.style.borderRadius = "50%";
  vtoken.style.transform = "translate(-50%, -50%)"; // center
  vtoken.style.zIndex = "1";
  vtoken.style.boxShadow = `inset ${tokenOffseter/2}px ${tokenOffseter/2}px ` + tokenOffseter + "px " + tokenOffseter/8 + "px rgba(0, 0, 0, 0.3)";

  vtoken.style.transition = `top ${dropSpeed}ms ease-in`;

  const tokenContainer = document.getElementById("tokenContainer");
  tokenContainer.appendChild(vtoken);
  
  if (cellDIV2) {
    const cell2Rect = cellDIV2.getBoundingClientRect();
    
    vtoken.style.top = cellRect.top - cellRect.height / 2 + "px";
    vtoken.style.left = cellRect.left + cellRect.width / 2 + "px";
    
    requestAnimationFrame(() => {
      vtoken.style.top = (cell2Rect.top + cell2Rect.height / 2) + "px";
      vtoken.style.left = (cell2Rect.left + cell2Rect.width / 2) + "px";
    });
  }
}

function circleOutline(cellDIV) {
  if (cellDIV) {
  } else {
    return;
  }
  const circleOutline = document.createElement("div");
  circleOutline.style.position = "absolute";
  circleOutline.style.top = "50%";
  circleOutline.style.left = "50%";
  circleOutline.style.width = "85%";
  circleOutline.style.height = "85%";
  circleOutline.style.background = "none";
  circleOutline.style.border = tokenOffseter / 4 + "px solid white";
  circleOutline.style.borderRadius = "50%";
  circleOutline.style.transform = "translate(-50%, -50%)"; // center
  circleOutline.style.zIndex = "11";

  const bigX = document.createElement("div");
  bigX.innerText = "X";
  bigX.style.position = "absolute";
  bigX.style.top = "50%";
  bigX.style.left = "50%";
  bigX.style.transform = "translate(-50%, -50%)"; // center text
  bigX.style.fontSize = tokenOffseter * 2 + "px"; // same size as tokenOffseter
  bigX.style.color = "white";
  bigX.style.zIndex = "12"; // ensure it appears above the circle outline
  circleOutline.appendChild(bigX);

  cellDIV.style.position = "relative";
  cellDIV.appendChild(circleOutline);
}

function findWin(col, row) {
  const oppTurn = 3 - turn;
  // highlights the wins
  // vertical
  if (tokenGridHeights[col] >= connectIn) {
    // only do if possible duh
    let vertical = 1;
    let divsToGlow = [];
    for (let i = 1; i < connectIn; ++i) {
      // TODO maybe .min is slow??
      if (tokenGrid[col][row - i] == oppTurn) {
        ++vertical;
        divsToGlow.push(document.getElementById(`${col}c${row - i}`));
        if (vertical == connectIn) {
          divsToGlow.forEach((cellDIV, index) => {
            circleOutline(cellDIV);
          });
          return turn;
        }
      } else {
        break;
      }
    }
  }

  // horizontal
  let horizontal = 1;
  let divsToGlowH = [];
  for (let i = 1; i < connectIn; ++i) {
    // right
    if (tokenGrid[col + i] && tokenGrid[col + i][row] == oppTurn) {
      ++horizontal;
      divsToGlowH.push(document.getElementById(`${col + i}c${row}`));
      if (horizontal == connectIn) {
        divsToGlowH.forEach((cellDIV, index) => {
          circleOutline(cellDIV);
        });
        return turn;
      }
    } else {
      break;
    }
  }
  for (let i = 1; i < connectIn; ++i) {
    // left
    if (tokenGrid[col - i] && tokenGrid[col - i][row] == oppTurn) {
      ++horizontal;
      divsToGlowH.push(document.getElementById(`${col - i}c${row}`));
      if (horizontal == connectIn) {
        divsToGlowH.forEach((cellDIV, index) => {
          circleOutline(cellDIV);
        });
        return turn;
      }
    } else {
      break;
    }
  }

  // diagonals

  let diagLeft = 1;
  let divsToGlowDL = [];
  for (let i = 1; i < connectIn; ++i) {
    if (
      tokenGrid[col + i] &&
      tokenGrid[col + i][row + i] &&
      tokenGrid[col + i][row + i] == oppTurn
    ) {
      ++diagLeft;
      divsToGlowDL.push(document.getElementById(`${col + i}c${row + i}`));
      if (diagLeft == connectIn) {
        divsToGlowDL.forEach((cellDIV, index) => {
          circleOutline(cellDIV);
        });
        return turn;
      }
    } else {
      break;
    }
  }
  for (let i = 1; i < connectIn; ++i) {
    if (
      tokenGrid[col - i] &&
      tokenGrid[col - i][row - i] &&
      tokenGrid[col - i][row - i] == oppTurn
    ) {
      ++diagLeft;
      divsToGlowDL.push(document.getElementById(`${col - i}c${row - i}`));
      if (diagLeft == connectIn) {
        divsToGlowDL.forEach((cellDIV, index) => {
          circleOutline(cellDIV);
        });
        return turn;
      }
    } else {
      break;
    }
  }

  // diagonals 2

  let diagRight = 1;
  let divsToGlowDR = [];

  for (let i = 1; i < connectIn; ++i) {
    if (
      tokenGrid[col + i] &&
      tokenGrid[col + i][row - i] &&
      tokenGrid[col + i][row - i] == oppTurn
    ) {
      ++diagRight;
      divsToGlowDR.push(document.getElementById(`${col + i}c${row - i}`));
      if (diagRight == connectIn) {
        divsToGlowDR.forEach((cellDIV, index) => {
          circleOutline(cellDIV);
        });
        return turn;
      }
    } else {
      break;
    }
  }
  for (let i = 1; i < connectIn; ++i) {
    if (
      tokenGrid[col - i] &&
      tokenGrid[col - i][row + i] &&
      tokenGrid[col - i][row + i] == oppTurn
    ) {
      ++diagRight;
      divsToGlowDR.push(document.getElementById(`${col - i}c${row + i}`));
      if (diagRight == connectIn) {
        divsToGlowDR.forEach((cellDIV, index) => {
          circleOutline(cellDIV);
        });
        return turn;
      }
    } else {
      break;
    }
  }

  return 0;
}

function visualizeGrid(noAnims) {
  const tokenContainer = document.getElementById("tokenContainer");
  tokenContainer.innerHTML = '';

  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const cellValue = tokenGrid[i][j];
      const cellDIV = document.getElementById(`${i}c${j}`);
      if (cellValue == 1) {
        (async () => {
          while (cellDIV.firstChild) {
            cellDIV.removeChild(cellDIV.firstChild);
          }
          if (i == lastDrop && j == tokenGridHeights[i]-1 && !noAnims) {
            const TopCell = document.getElementById(`${i}c${rows-1}`);
            tokenVisual(TopCell, tokenColRed, cellDIV);
            return;
          }
          tokenVisual(cellDIV, tokenColRed);
        })();
      } else if (cellValue == 2) {
        (async () => {
          while (cellDIV.firstChild) {
            cellDIV.removeChild(cellDIV.firstChild);
          }
          if (i == lastDrop && j == tokenGridHeights[i]-1 && !noAnims) {
            const TopCell = document.getElementById(`${i}c${rows-1}`);
            tokenVisual(TopCell, tokenColYellow, cellDIV);
            return;
          }
          tokenVisual(cellDIV, tokenColYellow);
        })();
      } else {
        while (cellDIV.firstChild) { // clear the trailing whites on wins
          cellDIV.removeChild(cellDIV.firstChild);
        }
      }
    }
  }
  /*let baseUrl = window.location.origin + window.location.pathname;
  let newQuery = cols + "," + rows
  for (let i = 0; i < moveStack.top+1; i++) {
    let item = moveStack.stack[i];
    newQuery += "," + item;
  }
  history.pushState(null, '', baseUrl + '?' + newQuery);*/
}

function unDropToken() {
  if (miniMaxIsProccesing == true) {
    return;
  }
  //for (let i = 0; i < 2; i++) {
    if (moveStack.stack[moveStack.top] || moveStack.stack[moveStack.top] == 0) {
      redoStack.push(moveStack.stack[moveStack.top]);
    }
    rawUndrop();
    lastDrop = moveStack.stack[moveStack.top];
    positionToken(visualToken, lastDrop);
    visualizeGrid(true);
  //}
}

function reDropToken() {
  if (miniMaxIsProccesing == true) {
    return;
  }
  const reDrop = redoStack.pop();
  if (reDrop || reDrop == 0) {
    rawDrop(reDrop);
    lastDrop = reDrop;
    positionToken(visualToken, reDrop);
    visualizeGrid();
    
    if (gameState != 0) {
      console.log("CONNECT 4", turn, gameState);

      if (findWin(lastDrop, tokenGridHeights[lastDrop] - 1) != 0) {
        circleOutline(
          document.getElementById(`${lastDrop}c${tokenGridHeights[lastDrop] - 1}`)
        );
      }
    }
      
  }
}

async function mainAI() {
  if (miniMaxIsProccesing == true) {
    return;
  }
  
  const insidebar = document.getElementById('insidebar');
  const drawbar = document.getElementById('drawbar');
  const evalUI = document.getElementById('eval');


  let score = 0;
  let bmove = genValidDrops()[0];
  let moveOrder = [];
  let deepDepth = 1;

  miniMaxIsProccesing = true;
  const maxDepth = rows*cols-moveStack.top+2 // - moves left +2 cuz im scared
  const st = performance.now() + aiThinkTime;
  for (let depth = 2; depth < maxDepth; depth++) {
    let maximize = false;
    if (turn == 2) { // YELLOW
      maximize = true;
      
      const [p_score, p_bmove, p_moveOrder] = await minmax(0, depth, maximize, -myHuge, myHuge);
      score = p_score;
      bmove = p_bmove;
      moveOrder = p_moveOrder;
    } else { // RED
      
      const [p_score, p_bmove, p_moveOrder] = await minmax(0, depth, maximize, -myHuge, myHuge);
      score = p_score;
      bmove = p_bmove;
      moveOrder = p_moveOrder;
    }
    deepDepth = depth;
    positionToken(visualToken, bmove);
    if (visualTokenText) {
    visualTokenText.innerText = String(depth);
    }
    if (performance.now() > st) {
      break;
    }
  }
  if (bmove == undefined) {
    await delay(1);
  }
  if (moveOrder != undefined) {
    moveOrder.reverse();
  }
  
  const absScore = Math.abs(score);
  let heightPercentage = 50 + (Math.log(absScore + 1) / Math.log(myHuge2 + 1)) * 50;
  if (absScore >= myHuge-maxDepth) {
    heightPercentage = 100;
    if (score > 0) {
      evalUI.textContent = "M"+((myHuge-absScore)/2-0.5)
    } else {
      evalUI.textContent = "M"+((myHuge-absScore)/2-0.5)
    }
  } else {
    evalUI.textContent = Math.floor(score)/10;
  }
  if (score > 0) {
    insidebar.style.height = `${clamp(heightPercentage,0,100)}%`;
  } else {
    insidebar.style.height = `${+clamp(100-heightPercentage,0,100)}%`;
  }
  if (moveOrder != undefined && moveOrder[0]) {
    const wins = moveOrder[0][1];
    const leafs = moveOrder[0][2]/(1+(absScore/100));
    const unitPercent = (
      Math.abs(wins-score)/(absScore+leafs)
    );
    let drawPercent = 100 - unitPercent*100
    console.log("DRAW?",drawPercent)
    
    if (drawPercent > 100) {
      drawPercent = 100
    }
    if (drawPercent < 0) {
      drawPercent = 0
    }
    
    drawbar.style.height = `${drawPercent*2}%`;
  }
  
  if (turn == 2) {
    console.log("YEL_AI MOVE", score, bmove, deepDepth);
  } else {
    console.log("RED_AI MOVE", score, bmove, deepDepth);
  }
  console.log("NODES:",nodes,"TRANS:",transTable.map.size,"MOVEORDER:",moveOrder)
  console.log("timetaken:", ((performance.now()-st)/1000));
  resetNodes();
  miniMaxIsProccesing = false;
  if (visualTokenText) {
  visualTokenText.innerText = '';
  }
  dropToken(bmove);
}

function dropToken(col) {
  if (miniMaxIsProccesing == true) {
    return;
  }
  redoStack.reset()
  rawDrop(col);
  //console.log("heuristic:", heuristic());
  //console.log("zobristKey: ", getZobrist())
  
  lastDrop = col;
  positionToken(visualToken, selectedCol);
  visualizeGrid();
  
  if (gameState != 0) {
    console.log("CONNECT 4", turn, gameState);

    if (findWin(lastDrop, tokenGridHeights[lastDrop] - 1) != 0) {
      circleOutline(
        document.getElementById(`${lastDrop}c${tokenGridHeights[lastDrop] - 1}`)
      );
    } else {
      for (let i = 0; i < cols; i++) {
        if (findWin(i, tokenGridHeights[i] - 1) != 0) {
          circleOutline(
            document.getElementById(`${i}c${tokenGridHeights[i] - 1}`)
          );
          break;
        }
      }
    }
  } else if (turn == 1 && redIsAI) {
    mainAI();
  } else if (turn == 2 && yelIsAI) {
    mainAI();
  }
}

// visual size in pc
let vCellWidth;
let vCellHeight;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function resetGameAndUI() {
  if (miniMaxIsProccesing == true) {
    return;
  }
  resetGame();
  selectedCol = Math.floor(cols / 2);
  const tokenContainer = document.getElementById("tokenContainer");
  tokenContainer.innerHTML = '';
}

let prevRow = rows;
let prevCol = cols;
function createGrid() {
  if (prevRow != rows || prevCol != cols) {
    resetGameAndUI();
  }
  prevRow = rows;
  prevCol = cols;

  const board = document.getElementById("Board");
  board.innerHTML = ""; // clear any existing content

  const ratio = Math.min(cols, rows) / Math.max(cols, rows);

  const cellSize = Math.min(window.innerWidth, window.innerHeight) * 0.12 * ratio ** 0.2;
  const avr = (cols / 2 + rows) / 1.5;
  const boardWidth = ((cols * cellSize) / avr) * 6;
  const boardHeight = ((rows * cellSize) / avr) * 6;

  const textSize = (cellSize / (cols + rows)) * 1.2;

  // set the board size
  board.style.borderRadius = (boardWidth+boardHeight)/100 + "px";
  board.style.width = `${boardWidth}px`;
  board.style.height = `${boardHeight}px`;

  const evalBar = document.createElement("div");
  evalBar.classList.add("evalBar");
  board.appendChild(evalBar);
  
  for (let i = 0; i < cols; i++) {
    const col = document.createElement("div");
    col.classList.add("column");
    col.id = `column-${i}`; // assign an ID to each column
    col.setAttribute("numindex", i);

    for (let j = 0; j < rows; j++) {
      const cell = document.createElement("div");
      cell.classList.add("cell");
      cell.id = `${i}c${j}`;
      col.appendChild(cell);
    }

    board.appendChild(col);
  }

  setTimeout(() => {
    if (visualToken) {
      resizeToken(visualToken);
    }
  }, 400); // 0.4s

  setTimeout(() => {
    if (visualToken) {
      positionToken(visualToken, selectedCol);
      updateTopbarPosition();
      if (miniMaxIsProccesing == false) {
        visualizeGrid(true);
      }
    }
  }, 400); // 0.4s
}

function heightChange(event) {
  if (parseInt(event.target.value)) {
  } else {
    return;
  }
  console.log("New height:", event.target.value);
  setRow(clamp(parseInt(event.target.value), 1, 20));
  createGrid();
  event.target.value = rows;
}
function widthChange(event) {
  if (parseInt(event.target.value)) {
  } else {
    return;
  }
  console.log("New width:", event.target.value);
  setCol(clamp(parseInt(event.target.value), 1, 20))
  createGrid();
  event.target.value = cols;
}
function connectInChange(event) {
  if (parseInt(event.target.value)) {
  } else {
    return;
  }
  console.log("New Connect In:", event.target.value);
  setConnectIn(clamp(parseInt(event.target.value), 2, 20))
  //createGrid();
  event.target.value = connectIn;
}
function thinktimeChange(event) {
    if (parseInt(event.target.value)) {
  } else {
    return;
  }
  aiThinkTime = parseInt(event.target.value);
  console.log("New ThinkTime:", aiThinkTime);
  aiThinkTime = clamp(aiThinkTime, 1, 8000);
  event.target.value = aiThinkTime;
}

function resizeToken(token) {
  const cell = document.querySelector(".cell");
  if (cell) {
    const cellSize = cell.getBoundingClientRect();
    vCellWidth = cellSize.width;
    vCellHeight = cellSize.height;
    const minSize = Math.min(cellSize.width, cellSize.height) * 0.8;
    tokenOffseter = minSize / 8;
    token.style.width = `${minSize}px`;
    token.style.height = `${minSize}px`;
    visualTokenText.style.fontSize = tokenOffseter * 2 + "px";
  }
}

function positionToken(token, col) {
  const cellDIV = document.getElementById(`${col}c${rows-1}`);
  if (cellDIV) {
    
  } else {
    return;
  }
  const colRect = cellDIV.getBoundingClientRect();
  const colCenterX = colRect.left + colRect.width / 2;
  const colCenterY = colRect.top - colRect.height/2;

  // Calculate the position for the token
  const left = colCenterX - token.offsetWidth / 2;
  const top = colCenterY - token.offsetHeight / 2;

  // Apply the positioning to the token
  token.style.position = 'absolute';
  token.style.left = `${left}px`;
  token.style.top = `${top}px`;
  token.style.boxShadow = "inset 0 0 " + tokenOffseter + "px " + tokenOffseter + "px rgba(0, 0, 0, 0.1)";
  
  if (turn == 2) {
    token.style.backgroundColor = tokenColYellow;
    visualTokenText.style.color = "black";
  } else {
    token.style.backgroundColor = tokenColRed;
    visualTokenText.style.color = "white";
  }
}

document.addEventListener("DOMContentLoaded", function () {
  let url = window.location.href;
  let queryString = url.split("?")[1];
  if (queryString) {
    let digitsArray = queryString.split(",").map(Number);
    setCol(digitsArray[0])
    setRow(digitsArray[1])
    createGrid();
    resetGameAndUI();
    let remainingDigits = digitsArray.slice(2);
    remainingDigits.forEach((digit) => {
      let num = parseInt(digit);
      if (num || num == 0) {
        rawDrop(num);
        selectedCol = num;
      }
    });
  }

  const board = document.getElementById("Board");

  const token = document.createElement("div");
  token.id = "token";
  token.style.backgroundColor = tokenColRed;

  const bigX = document.createElement("div");
  bigX.innerText = "";
  bigX.style.position = "absolute";
  bigX.style.top = "50%";
  bigX.style.left = "50%";
  bigX.style.transform = "translate(-50%, -50%)"; // center text
  //bigX.style.fontSize = tokenOffseter * 2 + "px"; // same size as tokenOffseter
  bigX.style.color = "white";
  bigX.style.zIndex = "12"; // ensure it appears above the circle outline
  token.appendChild(bigX);
  
  visualTokenText = bigX;
  visualToken = token;
  document.body.appendChild(token);

  function getClosestColumn(mouseX) {
    const columns = Array.from(board.getElementsByClassName("column"));
    let closestColumn = null;
    let minDistance = Infinity;

    columns.forEach((col) => {
      const rect = col.getBoundingClientRect();
      const colCenterX = rect.left + rect.width / 2;
      const distance = Math.abs(mouseX - colCenterX);

      if (distance < minDistance) {
        minDistance = distance;
        closestColumn = col;
      }
    });

    return closestColumn;
  }
  const handleMove = (event) => {
    const mouseX = event.clientX || event.touches[0].clientX;
    const closestCol = getClosestColumn(mouseX);
    const columns = board.getElementsByClassName("column");
    Array.from(columns).forEach((col) => col.classList.remove("highlight"));
    if (closestCol) {
      closestCol.classList.add("highlight");
      const colnumindex = parseInt(closestCol.getAttribute("numindex"));
      if (selectedCol != colnumindex) {
        selectedCol = colnumindex;
        if (miniMaxIsProccesing == false) {
          positionToken(token, selectedCol);
        }
      }
    }
  };

  board.addEventListener("mousemove", handleMove);
  board.addEventListener("touchmove", handleMove);

  createGrid();

  const numberInput = document.getElementById("cheight");
  numberInput.addEventListener("input", heightChange);
  const numberInput2 = document.getElementById("cwidth");
  numberInput2.addEventListener("input", widthChange);
  const numberInput3 = document.getElementById("connectin");
  numberInput3.addEventListener("input", connectInChange);
  const numberInput4 = document.getElementById("thinktime");
  numberInput4.addEventListener("input", thinktimeChange);

  document.addEventListener("click", function (event) {
    // mouse click
    if (
      event.target.tagName != "BUTTON" &&
      event.target.tagName != "LABEL" &&
      event.target.tagName != "INPUT" &&
      gameState == 0
    ) {
      //console.log(event.target.tagName);
      dropToken(selectedCol);
    }
  });
});

function updateTopbarPosition() {
  const targetDiv = document.getElementById('Board');
  const topbar = document.getElementById('topbar');
  const insidebar = document.getElementById('insidebar');
  const drawbar = document.getElementById('drawbar');
  const evalUI = document.getElementById('eval');

  const targetRect = targetDiv.getBoundingClientRect();
  const width = targetRect.width/30;

  topbar.style.top = `${targetRect.top}px`;
  topbar.style.left = `${targetRect.right + width/2}px`;
  topbar.style.width = width + 'px';
  topbar.style.height = `${targetRect.height}px`;
  topbar.style.filter = "brightness(90%)";
  topbar.style.backgroundColor = tokenColRed;
  
  evalUI.style.fontSize = width*0.5+'px';
  evalUI.style.bottom = width*0.2+'px';
  evalUI.textContent = "?"
  
  insidebar.style.backgroundColor = tokenColYellow;
  insidebar.style.width = '100%';
  insidebar.style.height = '50%';
  
  drawbar.style.width = '100%';
  drawbar.style.height = '200%';
}

window.addEventListener("resize", function () {
  createGrid();
});

function clearGame() {
  if (miniMaxIsProccesing == true) {
    return;
  }
  resetGameAndUI();
  createGrid();
}

function yellowAi(button) {
  setYelIsAI(!yelIsAI);
  button.textContent = `🟡 Yellow [${yelIsAI ? "AI" : "Human"}]`;
  console.log("yellow is ai set to", yelIsAI, turn);
  if (yelIsAI && turn == 2) {
    console.log("USE AI")
    mainAI()
  }
}

function redAi(button) {
  setRedIsAI(!redIsAI);
  button.textContent = `🔴 Red [${redIsAI ? "AI" : "Human"}]`;
  console.log("red is ai set to");
  if (redIsAI && turn == 1) {
    console.log("USE AI")
    mainAI()
  }
}

export {
  yellowAi,
  redAi,
  unDropToken,
  reDropToken,
  clearGame,
  // ...other exports
};

// Attach them to the window object to make them accessible globally
window.yellowAi = yellowAi;
window.redAi = redAi;
window.unDropToken = unDropToken;
window.reDropToken = reDropToken;
window.clearGame = clearGame;