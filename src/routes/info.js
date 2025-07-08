const startTime = Date.now();
const { getStatus } = require('../heartSystem/heart.js');
const serverInfo = require('../serverInfo.js')

module.exports = (req, res) => {
  const now = Date.now();
  const msUptime = now - startTime;

  const seconds = Math.floor(msUptime / 1000) % 60;
  const minutes = Math.floor(msUptime / 1000 / 60) % 60;
  const hours = Math.floor(msUptime / 1000 / 60 / 60);

  res.json({
    requestsReceived: serverInfo.requestsReceived,
    uptime_ms: msUptime,
    uptime: `${hours}h ${minutes}m ${seconds}s`,
    heart: getStatus()
  });
}