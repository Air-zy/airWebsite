const MultiYearStatusLog = require('./MultiYearStatusLog.js');
const { analyze, backIn } = require('./forecastStatus.js');
const statusDoc = require('../../firebase/azyFirebase.js').statusDoc


//

let cachedValue = null;
let cachedAnalysis = null;
let lastFetched = 0;
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

async function getStatusLog() {
    const now = Date.now();
    if (cachedValue && (now - lastFetched < CACHE_DURATION)) {
        return cachedValue;
    }

    console.log('[Status Tracker] loading existing status');
    const snapshot = await statusDoc.get();
    const data = snapshot.data();

    const log = MultiYearStatusLog.deserialize(data.log);
    cachedValue = log;
    cachedAnalysis = null;
    lastFetched = now;

    return log
}

// analyze walks every stored hour, so only redo it when the log reloads
async function getAnalysis() {
    const log = await getStatusLog();
    return cachedAnalysis ??= analyze(log);
}

//

async function getLastOnline() {
    try {
        const statusLog = await getStatusLog();
        const lastOnline = statusLog.getLastOnline();

        const minsAgo = Math.floor((Date.now() - lastOnline.getTime()) / 60000)

        return {
            lastOn: lastOnline.toISOString(),
            minsAgo: minsAgo,
            // not seen this hour, so guess when
            backIn: minsAgo >= 60 ? backIn(await getAnalysis()) : undefined,
        };
    } catch (err) {
        console.error('[Status Tracker] ERROR:', err);
    }
}

// ends on the current hour, so the grid never trails into the future
async function getRollingStatus(days) {
    const statusLog = await getStatusLog();
    const now = new Date();
    const hours = days * 24;

    const currentHour = Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        now.getUTCHours()
    );

    const start = new Date(currentHour - (hours - 1) * 3600000);
    return statusLog.getHourlyStatusLog(start, hours).toJSON();
}

module.exports = { getStatusLog, getAnalysis, getLastOnline, getRollingStatus };