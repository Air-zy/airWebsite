const envDecrypt = require('../utils/envDecrypt.js');
const clusterAcolyteToken = process.env.airClusterAcolyteToken

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
      res.setHeader(key, value);
    });
    
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    res.send(buffer);
    //response.body.pipe(res);
  } catch (err) {
    console.log(err)
    res.status(500).json({
      acolyte_error: err.toString()
    });
  }
}