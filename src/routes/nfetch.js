const envDecrypt = require('../FallbackEncryption/envDecrypt.js');
const clusterAcolyteToken = process.env.airClusterAcolyteToken
const { Readable, pipeline } = require("stream");

module.exports = async (req, res) => { // node fetch gateway
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || envDecrypt(process.env.publicClusterKey, authHeader) !== clusterAcolyteToken) {
      return res.sendStatus(401);
    }
    
    const { url, options } = req.body;
    const response = await fetch(url, options);
    res.status(response.status);
    response.headers.forEach((value, key) => {
      if (key.toLowerCase() !== "content-encoding") {
        res.setHeader(key, value);
      }
    });
    
    const nodeStream = Readable.fromWeb(response.body);
    pipeline(nodeStream, res, (err) => {
      if (err) console.error("Pipeline failed:", err);
    });
  } catch (err) {
    console.log(err)
    res.status(500).json({
      acolyte_error: err.toString()
    });
  }
}