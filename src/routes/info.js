const os = require('os');
const startTime = Date.now();
const { getStatus } = require('../heartSystem/heart.js');
const serverInfo = require('./middleware/serverInfo.js')

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