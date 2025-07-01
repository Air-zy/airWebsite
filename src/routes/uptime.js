const startTime = Date.now();

module.exports = (req, res) => {
  const now = Date.now();
  const msUptime = now - startTime;

  const seconds = Math.floor(msUptime / 1000) % 60;
  const minutes = Math.floor(msUptime / 1000 / 60) % 60;
  const hours = Math.floor(msUptime / 1000 / 60 / 60);

  res.json({
    uptime_ms: msUptime,
    uptime: `${hours}h ${minutes}m ${seconds}s`
  });
}