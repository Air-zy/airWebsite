const fs = require('fs');
const path = require('path');

const serverInfo = require('./serverInfo.js')
const config = require('./config/default.json');
const logStream = fs.createWriteStream(path.join(__dirname, config.log.file), { flags: 'a' });

function getIP(req) {
  const ipList = req.headers['x-forwarded-for']
  if (ipList) {
    const ips = ipList.split(',');
    const firstIp = ips[0].trim();
    return firstIp;
  }

  return req.connection?.remoteAddress ||
         req.socket?.remoteAddress ||
         req.connection?.socket?.remoteAddress ||
         null;
}

module.exports = (req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      serverInfo.requestsReceived += 1;
      const duration = Date.now() - start;
      const line = [
          getIP(req),
          new Date().toISOString(),
          req.method,
          req.originalUrl,
          res.statusCode,
          `${duration}ms`,
          req.headers['user-agent']
      ].join(' ') + '\n';

      //process.stdout.write(line);
      logStream.write(line);
    });
    next();
};
