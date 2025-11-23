
const { firedbActivityGet, firedbActivitySet } = require('../firebasedb.js')

function newDateStr() {
  let newDateStr = new Date().toISOString()
  return newDateStr;
}

let currentStatus = {
  status: "",
  lastOn: newDateStr(),
  history: [] // last 254 statuses
}

let lastUpdate2 = 0;
async function commitCurrentStatus() {
  const now = Date.now();
  if (now > lastUpdate2 + 6000 && currentStatus.status != "" && currentStatus.status) {
    lastUpdate2 = now;

    currentStatus.history.push({
      status: currentStatus.status,
      timestamp: currentStatus.lastOn
    });

    if (currentStatus.history.length > 1000) {
      currentStatus.history = currentStatus.history.slice(-1000);
    }

    currentStatus.lastOn = newDateStr();
    firedbActivitySet(currentStatus);
  }
}

async function initStatus() {
  const meActivityGet = await firedbActivityGet()
  currentStatus = meActivityGet;
  if (!currentStatus.history) currentStatus.history = [];
}
initStatus();

const envDecrypt = require('../FallbackEncryption/envDecrypt.js');
const airWebToken = envDecrypt(process.env.airKey, process.env.airWebToken)

function start(app, newWS) {
    const wss = newWS.wss;
    function broadcast() {
        const msg = JSON.stringify(currentStatus);
        newWS.broadcast(msg);
    }

    wss.on('connection', ws => {
        console.log("WS client connected", currentStatus);
        ws.send(JSON.stringify(currentStatus));
        ws.on('close', () => {
            console.log("WS client disconnected");
        });
    });

    const presence = (req, res) => {
      const authHeader = req.headers['authorization'];
      if (!authHeader) {
          return res.status(401).json({ error: 'Authorization header missing' });
      }

      const token = authHeader.split(' ')[1];
      if (token != airWebToken) {
        return res.status(403).json({ error: 'Invalid password' });
      }

      const status = req.body.status;
      if (status == "offline") {
        currentStatus.status = status;
        broadcast();
        
        commitCurrentStatus();
      } else if (status == "online") {
        currentStatus.status = status;
        currentStatus.lastOn = newDateStr();
        broadcast();
        
        commitCurrentStatus();
      } else if (status == "dnd") {
        currentStatus.status = status;
        currentStatus.lastOn = newDateStr();
        broadcast();
        
        commitCurrentStatus();
      } else if (status == "idle") {
        currentStatus.status = status;
        currentStatus.lastOn = newDateStr();
        broadcast();
        
        commitCurrentStatus();
      }
      
      res.status(200).json({ data: status });
    }
    
    return presence;
}

module.exports = { start: start }