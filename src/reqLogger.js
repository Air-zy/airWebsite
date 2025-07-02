const fs = require('fs');
const path = require('path');

const config = require('./config/default.json');
const logStream = fs.createWriteStream(path.join(__dirname, config.log.file), { flags: 'a' });

module.exports = (req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    const line = [
      new Date().toISOString(),
      req.method,
      req.originalUrl,
      res.statusCode,
      `${duration}ms`
    ].join(' ') + '\n';

    process.stdout.write(line);
    logStream.write(line);
  });
  next();
};
