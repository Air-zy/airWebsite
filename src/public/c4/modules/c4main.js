class IntStack {
  constructor() {
    this.stack = [];
    this.top = -1;
  }
  push(v) {
    this.stack[++this.top] = v;
  }
  pop() {
    if (this.top >= 0) {
      const value = this.stack[this.top];
      this.stack[this.top--] = undefined;
      return value;
    }
  }
  reset() {
    this.stack = [];
    this.top = -1;
  }
}

class TranspositionTable {
  constructor() {
    this.map = new Map();
  }

  // to set a value for a given Uint32 key
  set(key, score, bestMove, depth) {
    this.map.set(key, { score, bestMove, depth });
  }

  // to get the value for a given Uint32 key
  get(key, depth) {
    //return undefined; // if i wanna disable uncomment
    const entry = this.map.get(key)
    if (entry) {
      if (entry.depth <= depth) {
        return undefined;
      }
      //console.log(entry);
      return [entry.score, entry.bestMove];
    }
    return undefined;
  }

  clear() {
    this.map.clear();
  }
}

function getRandomUint32() {
    return Math.floor(Math.random() * (2 ** 32)) >>> 0;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const transTable = new TranspositionTable();
const moveStack = new IntStack();

let cols = 7;
let rows = 6;
let connectIn = 4;
let redIsAI = false;
let yelIsAI = true;

let turn = 1; //1 red // 2 yellow
let gameState = 0; // 0 none // 1 redwin // 2 yellowwin // 3draw
let tokenGrid = [
  [0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0],
];

let weightingGrid;
let weightingGridInvert;
makeWeightingGrid()

let zobristGridRed = new Array(cols);
let zobristGridYellow = new Array(cols);
for (let i = 0; i < cols; i++) {
  zobristGridRed[i] = new Uint32Array(rows);
  zobristGridYellow[i] = new Uint32Array(rows);
  for (let j = 0; j < rows; j++) {
    zobristGridRed[i][j] = getRandomUint32();
    zobristGridYellow[i][j] = getRandomUint32();
  }
}
console.log(weightingGrid, zobristGridRed, zobristGridYellow);

let tokenGridHeights = [0, 0, 0, 0, 0, 0, 0];

// for ai stuff
let midMoveOrderPreset = [3, 2, 4, 1, 5, 0, 6];

function makeWeightingGrid() {
  if (parseInt(cols) && parseInt(cols) > 0 && parseInt(rows) && parseInt(rows) > 0) {
  } else {
    return;
  }
  const arrGrid = new Array(cols);
  for (let i = 0; i < cols; i++) {
    arrGrid[i] = new Array(rows);
  }

  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      arrGrid[i][j] = 0;
    }
  }

  const midRow = rows - 1;
  const midCol = cols - 1;
  weightingGrid = arrGrid.map((row, rowIndex) => {
    return row.map((_, colIndex) => {
      let rowValue = Math.abs(midCol - rowIndex * 2);
      let colValue = Math.abs(midRow+1 - colIndex * 2);
      if (colIndex == 0) {
        colValue+=2;
      }
      return parseInt((rowValue*2 + colValue*2)**0.7);
    });
  });
  const gridTotal = parseInt((rows*2 + cols*2)**0.5);
  weightingGridInvert = arrGrid.map((row, rowIndex) => {
    return row.map((_, colIndex) => {
      let rowValue = Math.abs(midCol - rowIndex * 2);
      let colValue = Math.abs(midRow*2 - colIndex * 2);
      return Math.max((gridTotal - parseInt((rowValue*2 + colValue*2)**0.5))*2,1);
    });
  });
  //console.warn(weightingGridInvert);
}

function resetGame() {
  if (parseInt(cols) && parseInt(cols) > 0 && parseInt(rows) && parseInt(rows) > 0) {
  } else {
    return;
  }
  gameState = 0;
  transTable.clear();
  moveStack.reset();
  turn = 1;
  const arrGrid = new Array(cols);
  for (let i = 0; i < cols; i++) {
    arrGrid[i] = new Array(rows);
  }

  tokenGridHeights = new Uint8Array(cols);
  for (let i = 0; i < cols; i++) {
    tokenGridHeights[i] = 0;
    for (let j = 0; j < rows; j++) {
      arrGrid[i][j] = 0;
    }
  }
  
  const midRow = rows - 1;
  const midCol = cols - 1;
  weightingGrid = arrGrid.map((row, rowIndex) => {
    return row.map((_, colIndex) => {
      let rowValue = Math.abs(midCol - rowIndex * 2);
      let colValue = Math.abs(midRow+1 - colIndex * 2);
      if (colIndex == 0) {
        colValue+=2;
      }
      return parseInt((rowValue*2 + colValue*2)**0.7);
    });
  });
  const gridTotal = parseInt((rows*2 + cols*2)**0.5);
  weightingGridInvert = arrGrid.map((row, rowIndex) => {
    return row.map((_, colIndex) => {
      let rowValue = Math.abs(midCol - rowIndex * 2);
      let colValue = Math.abs(midRow*2 - colIndex * 2);
      return Math.max((gridTotal - parseInt((rowValue*2 + colValue*2)**0.5))*2,1);
    });
  });
  //console.warn(weightingGridInvert);
  zobristGridRed = new Array(cols);
  zobristGridYellow = new Array(cols);
  for (let i = 0; i < cols; i++) {
    zobristGridRed[i] = new Uint32Array(rows);
    zobristGridYellow[i] = new Uint32Array(rows);
    for (let j = 0; j < rows; j++) {
      zobristGridRed[i][j] = getRandomUint32();
      zobristGridYellow[i][j] = getRandomUint32();
    }
  }

  tokenGrid = arrGrid;
  
  // generate midMoveOrderPreset
  const countingArr = Array.from({ length: cols }, (_, index) => index);

  const arr = Array.from({ length: cols }, (_, index) => index);
  const middle = Math.floor(arr.length / 2);
  arr.sort((a, b) => {
    const distA = Math.abs(a - middle);
    const distB = Math.abs(b - middle);
    if (distA !== distB) {
      return distA - distB;
    }
    return a - b;
  });
  midMoveOrderPreset = arr;
  console.log(weightingGrid);
}

function setCol(newCol) {
  cols = newCol;
}

function setRow(newRow) {
  rows = newRow;
}

function setConnectIn(newConnectIn) {
  connectIn = newConnectIn;
}

function setRedIsAI(val) {
  redIsAI = val;
}

function setYelIsAI(val) {
  yelIsAI = val;
}

function flipTurns() {
  if (turn == 1) {
    turn = 2;
  } else {
    turn = 1;
  }
}

function checkWin(col, row) {
  const oppTurn = 3 - turn;

  // horizontal
  let horizontal = 1;
  for (let i = 1; i < connectIn; ++i) {
    // right
    if (tokenGrid[col + i] && tokenGrid[col + i][row] == oppTurn) {
      ++horizontal;
      if (horizontal == connectIn) {
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
      if (horizontal == connectIn) {
        return turn;
      }
    } else {
      break;
    }
  }
  
  //vertical
  if (tokenGridHeights[col] >= connectIn) {
    // only do if possible duh
    let vertical = 1;
    for (let i = 1; i < connectIn; ++i) {
      if (tokenGrid[col][row - i] == oppTurn) {
        ++vertical;
        if (vertical == connectIn) {
          return turn;
        }
      } else {
        break;
      }
    }
  }

  // diagonals

  let diagLeft = 1;
  for (let i = 1; i < connectIn; ++i) {
    const coli = tokenGrid[col + i]
    if (
      coli &&
      coli[row + i] &&
      coli[row + i] == oppTurn
    ) {
      ++diagLeft;
      if (diagLeft == connectIn) {
        return turn;
      }
    } else {
      break;
    }
  }
  for (let i = 1; i < connectIn; ++i) { 
    const coli = tokenGrid[col - i]
    if (
      coli &&
      coli[row - i] &&
      coli[row - i] == oppTurn
    ) {
      ++diagLeft;
      if (diagLeft == connectIn) {
        return turn;
      }
    } else {
      break;
    }
  }

  // diagonals 2

  let diagRight = 1;
  for (let i = 1; i < connectIn; ++i) {
    const coli = tokenGrid[col + i]
    if (
      coli &&
      coli[row - i] &&
      coli[row - i] == oppTurn
    ) {
      ++diagRight;
      if (diagRight == connectIn) {
        return turn;
      }
    } else {
      break;
    }
  }
  for (let i = 1; i < connectIn; ++i) {
    const coli = tokenGrid[col - i]
    if (
      coli &&
      coli[row + i] &&
      coli[row + i] == oppTurn
    ) {
      ++diagRight;
      if (diagRight == connectIn) {
        return turn;
      }
    } else {
      break;
    }
  }
  return 0;
}

function checkWin2(col, row, oppTurn) {
  // horizontal
  let horizontal = 1;
  for (let i = 1; i < connectIn; ++i) {
    // right
    if (tokenGrid[col + i] && tokenGrid[col + i][row] == oppTurn) {
      ++horizontal;
      if (horizontal == connectIn) {
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
      if (horizontal == connectIn) {
        return turn;
      }
    } else {
      break;
    }
  }
  
  //vertical
  if (tokenGridHeights[col] >= connectIn) {
    // only do if possible duh
    let vertical = 1;
    for (let i = 1; i < connectIn; ++i) {
      if (tokenGrid[col][row - i] == oppTurn) {
        ++vertical;
        if (vertical == connectIn) {
          return turn;
        }
      } else {
        break;
      }
    }
  }

  // diagonals

  let diagLeft = 1;
  for (let i = 1; i < connectIn; ++i) {
    const coli = tokenGrid[col + i]
    if (
      coli &&
      coli[row + i] &&
      coli[row + i] == oppTurn
    ) {
      ++diagLeft;
      if (diagLeft == connectIn) {
        return turn;
      }
    } else {
      break;
    }
  }
  for (let i = 1; i < connectIn; ++i) {
    const coli = tokenGrid[col - i]
    if (
      coli &&
      coli[row - i] &&
      coli[row - i] == oppTurn
    ) {
      ++diagLeft;
      if (diagLeft == connectIn) {
        return turn;
      }
    } else {
      break;
    }
  }

  // diagonals 2

  let diagRight = 1;
  for (let i = 1; i < connectIn; ++i) {
    const coli = tokenGrid[col + i]
    if (
      coli &&
      coli[row - i] &&
      coli[row - i] == oppTurn
    ) {
      ++diagRight;
      if (diagRight == connectIn) {
        return turn;
      }
    } else {
      break;
    }
  }
  for (let i = 1; i < connectIn; ++i) {
    const coli = tokenGrid[col - i]
    if (
      coli &&
      coli[row + i] &&
      coli[row + i] == oppTurn
    ) {
      ++diagRight;
      if (diagRight == connectIn) {
        return turn;
      }
    } else {
      break;
    }
  }
  
  return 0;
}


function rawDrop(col) {
  if (gameState != 0) {
    return;
  }
  const h = tokenGridHeights[col];
  if (h < rows) {
    moveStack.push(col);
    tokenGrid[col][h] = turn;
    ++tokenGridHeights[col];

    flipTurns();
    gameState = checkWin(col, h);
  }
}
function rawUndrop() {
  gameState = 0;
  const col = moveStack.pop();
  if (col || col == 0) {
    --tokenGridHeights[col];
    tokenGrid[col][tokenGridHeights[col]] = 0;
    flipTurns();
  }
}

function genValidDrops() { // returns an uint8 number list of col amt
  let moves = [];
  for (let i = 0; i < cols; i++) {
    if (tokenGridHeights[midMoveOrderPreset[i]] < rows) {
      moves.push(midMoveOrderPreset[i]);
    }
  }
  return moves;
}

function getZobrist() {
  let key = 0;
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < tokenGridHeights[i]; j++) {
      const token = tokenGrid[i][j];
      if (token == 1) {
        key = key ^ token ^ zobristGridRed[i][j];
      } else {
        key = key ^ token ^ zobristGridYellow[i][j];
      }
    }
  }
  return key;
}

const myHuge = 100000
const myHuge2 = 10000

import {
  minmax,
  nodes,
  resetNodes,
} from './c4minimaxVerbose.js';

export {
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
  getZobrist,
  checkWin,
  checkWin2,
  weightingGrid,
  weightingGridInvert
};