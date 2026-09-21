const pad = n => String(n).padStart(2, '0');

module.exports = {
    requestsReceived: 0,
    uptime() {
        const s = Math.floor(process.uptime());
        return `${Math.floor(s / 3600)}h ${pad(Math.floor(s / 60) % 60)}m ${pad(s % 60)}s`;
    },
};
