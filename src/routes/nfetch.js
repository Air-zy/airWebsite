const { Readable, pipeline } = require("stream");

// auth lives on the route declaration, see rootRouter.js
module.exports = async (req, res) => { // node fetch gateway
  try {
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