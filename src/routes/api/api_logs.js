const fs   = require('fs');
const config = require('../../config/default.json');

module.exports = async (req, res) => {
    const logFile = config.log.file;
    res.setHeader('Content-Type', 'text/plain');
    const readStream = fs.createReadStream(logFile);
    readStream.on('error', err => {
        res.status(500).send('Could not read log file');
    });
    readStream.pipe(res);
};
