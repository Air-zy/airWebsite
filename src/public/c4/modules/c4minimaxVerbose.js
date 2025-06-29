import {
  transTable,
  myHuge, // number for win
  myHuge2, // number for semi win
  getZobrist,
  gameState,
  genValidDrops,
  rawDrop,
  rawUndrop,
  tokenGridHeights,
  checkWin,
  checkWin2,
  cols,
  rows,
  weightingGridInvert,
  tokenGrid,
  weightingGrid,
  
} from './c4main.js';

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function additive(v,v2) {
  if (v > 0) {
    return v + v2
  } else if (v < 0) {
    return v - v2
  }
  return v
}

function heuristic() {
  let score = 0;
  let redInstantWins = 0;
  let yellowInstantWins = 0;
  for (let i = 0; i < cols; i++) {
    const h = tokenGridHeights[i];
    if (h+1 <= rows) {
     
      // trap bonus
      const redwin = checkWin2(i, h+1, 1);
      const yelwin = checkWin2(i, h+1, 2);
      if (redwin) {
        score -= 400;
      } else if (yelwin) {
        score += 400;
      }
    }
    
    //
    const grounderiswinner = checkWin(i, h);
    if (grounderiswinner == 2) {
      ++yellowInstantWins;
    } else if (grounderiswinner == 1) {
      ++redInstantWins;
    }
      
    if (yellowInstantWins >= 2) {
      return -myHuge2;
    }
    if (redInstantWins >= 2) {
      return myHuge2;
    }
    
    let prev = 0;
    for (let j = 0; j < h; j++) {
      const token = tokenGrid[i][j]
      
      
      if (prev == token && i > 0 && i < cols-1) { // bonus if two of same tokens are on eachother
        //console.log(i)
        if (tokenGridHeights[i-1] < h || tokenGridHeights[i+1] > h) { // if cols beside are lower
          if (token == 2) {
            score += weightingGridInvert[i][j]
          } else if (token == 1) {
            score -= weightingGridInvert[i][j]
          }
        }
      }
      prev = token;
      
      
      // the weighting grids use - because it leads to numbers closer to 0 better for math
      if (token == 2) {
        score -= weightingGrid[i][j];
      } else if (token == 1) {
        score += weightingGrid[i][j];
      }
    }
  }
  return score;
}


let cint = 0;
let nodes = 0;
let wins = 0;
let leafs = 0;

function resetNodes() {
  nodes = 0;
  wins = 0;
  leafs = 0;
};

async function minmax(distance, depth, isMaxer, alpha, beta) {
  ++nodes;
  const zobKey = getZobrist();
  const transValue = transTable.get(zobKey, depth)
  if (transValue) {
    return transValue;
  }
  
  if (gameState == 1) {
    ++wins;
    return [myHuge-distance];
  } else if (gameState == 2) {
    --wins;
    return [-myHuge+distance];
  }
  
  if (depth == 0) {
    ++leafs;
    ++cint;
    if (cint > 4000) {
      cint = 0;
      await delay(1);
    }
    return [additive(heuristic(),distance)];//[0]; // heuristic
  }
  
  const moves = genValidDrops();
  if (moves.length == 0) {
    return [0];
  }

  let bestMoves = [];

  if (isMaxer) {
    let max = -myHuge;
    let tbmove = 0;
    for (let i = 0; i < moves.length; ++i) {
      rawDrop(moves[i]);
      let [score, bmove, n_bestMoves] = await minmax(distance+1, depth - 1, false, alpha, beta);
      rawUndrop();
      if (score > max) {
        tbmove = moves[i];
        max = score;
        if (n_bestMoves != undefined) {
          bestMoves = n_bestMoves
        }
      }
    	if (score >= beta) { // beta cutoff (next node recieved previous node is superior)
				break;
      }
			if (score > alpha) { // tell next nodes
				alpha = score
      }
    }
    transTable.set(zobKey, max, tbmove, depth);
    if (bestMoves) {
      bestMoves.push([tbmove,wins,leafs]);
    }
    return [max, tbmove, bestMoves];
  } else {
    let tbmove = 0;
    let min = myHuge;
    for (let i = 0; i < moves.length; ++i) {
      rawDrop(moves[i]);
      let [score, bmove, n_bestMoves] = await minmax(distance+1, depth - 1, true, alpha, beta);
      rawUndrop();
      if (score < min) {
        tbmove = moves[i];
        min = score;
        if (n_bestMoves != undefined) {
          bestMoves = n_bestMoves
        }
      }
    	if (score <= alpha) { // alpha cutoff (next node recieved previous node is superior)
				break;
      }
			if (score < beta) { // tell next nodes
				beta = score;
      }
    }
    transTable.set(zobKey, min, tbmove, depth);
    if (bestMoves) {
      bestMoves.push([tbmove,wins,nodes]);
    }
    return [min, tbmove, bestMoves];
  }
}

export {minmax, nodes, resetNodes};