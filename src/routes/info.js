const os = require('os');
const startTime = Date.now();
const { getStatus } = require('../heartSystem/heart.js');
const serverInfo = require('./middleware/serverInfo.js')

module.exports = (req, res) => {
  const now = Date.now();
  const msUptime = now - startTime;

  res.json({
    requestsReceived: serverInfo.requestsReceived,
    uptime_ms: msUptime,
    uptime: serverInfo.uptime(),
    heart: getStatus(),
    os: {
      platform: os.platform(),
      release: os.release(),           // kernel ver
      arch: os.arch(),                 // CPU architecture
      cpus: os.cpus(),                 // num of cores
      loadavg: os.loadavg(),           // 1, 5, and 15‑min load averages
      totalMem: os.totalmem(),         // bytes
      freeMem: os.freemem(),           // bytes
      uptime: os.uptime()              // sec
    },
    metrics: {
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage(),
    },
  });
}