const { firedbRobloxGet, firedbRobloxSave } = require('../../firebasedb.js');
const { idtoname } = require('./rblxutils.js')
const zlib = require('zlib');

let last_gam3_comitted = {}
async function commitRblxData(receivedData) {
  last_gam3_comitted = receivedData
  const stringifiedData = JSON.stringify(receivedData)
  const compressedData = zlib.gzipSync(stringifiedData);
  const base64CompressedData = compressedData.toString('base64');
      
  const originalSize = Buffer.byteLength(stringifiedData);           // Size of the original object
  const compressedSize = Buffer.byteLength(base64CompressedData);    // Size of the gzipped data

  function formatSizeToMB(size) {
    const sizeInMB = size / (1024 * 1024);  // Convert bytes to MB
    return sizeInMB.toFixed(2).toLocaleString();  // Fixed to 2 decimal places and formatted with commas
  }

  firedbRobloxSave(base64CompressedData)
      
  console.log(`rblxDS | Original size: ${formatSizeToMB(originalSize)} MB`);
  console.log(`rblxDS | Compressed size: ${formatSizeToMB(compressedSize)} MB`);
}

let cache = {
  data: null,
  lastFetch: 0,
  cacheDuration: 60000 // 1 min
};

async function getRawRobloxData() {
  const compressedData = await firedbRobloxGet();
  const compressedBuffer = Buffer.from(compressedData.rblxdata, 'base64');
  return JSON.parse(zlib.gunzipSync(compressedBuffer));
}

/*
async function processRblxData(decompressedData) {
    for (const [key, value] of Object.entries(decompressedData.PlrDataDSv3)) {
        if (!("Name" in value)) {
            try {
                value.Name = await idtoname(key); // Call your function here
            } catch(err) {
                console.log("process rblx data err: ", err)
            }
        }
    }
}*/

async function getRblxDataDecompressed() {
  const now = Date.now();

  if (cache.data && now - cache.lastFetch < cache.cacheDuration) {
    console.log("Returning cached data");
    if (last_gam3_comitted.length != 0 && JSON.stringify(last_gam3_comitted) != '{}') {
      return last_gam3_comitted
    } else {
      return cache.data;
    }
  }

  console.log("Fetching fresh data...");
  const decompressedData = await getRawRobloxData()// await firedbRobloxGet()
  //await processRblxData(decompressedData)

  cache.data = decompressedData;
  cache.lastFetch = now;

  return decompressedData;
}

function startrbx(app) {
    app.post('/gam3push', require('./routes/gam3push.js'));
    app.get('/api/roblox-user/:userId', require('./routes/userlookup.js'));

    app.get('/api/gam3DB', async (req, res) => {
        try {
            const data = await getRblxDataDecompressed();
            res.status(200).json(data);
        } catch (error) {
            console.error('Error processing request:', error);
            res.status(500).json({ message: 'Server error' });
        }
    })

    app.post('/api/gam3DB', (req, res) => {
        const authHeader = req.headers['authorization'];

        if (!authHeader) {
            console.log("auth missing api/rblx")
            return res.status(401).json({ error: 'Authorization header missing' });
        }
        
        if (authHeader == airWebToken) {
            try {
                const receivedData = req.body;
                console.log('Received data from Roblox:', receivedData);
                commitRblxData(receivedData)
                
                res.status(200).json({ message: 'Data received successfully' });
            } catch (error) {
                console.error('Error processing request:', error);
                res.status(500).json({ message: 'Server error' });
            }
        } else {
            console.log("invalid pass api/rblx", authHeader)
            return res.status(403).json({ error: 'Invalid password' });
    }
    });
}

module.exports = { startrbx };