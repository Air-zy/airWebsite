const MultiYearStatusLog = require('./MultiYearStatusLog.js');
const statusDoc = require('../../firebase/azyFirebase.js').statusDoc


//

let cachedValue = null;
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
    lastFetched = now;

    return log
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
        };
    } catch (err) {
        console.error('[Status Tracker] ERROR:', err);
    }
}

async function getWeeklyStatus() {
    try {
        const statusLog = await getStatusLog();
        const now = new Date();

        // normalize to UTC hour start
        const current = new Date(Date.UTC(
            now.getUTCFullYear(),
            now.getUTCMonth(),
            now.getUTCDate(),
            now.getUTCHours(),
            0, 0, 0
        ));

        // get day of week (0 = Sunday, 1 = Monday, ...)
        let day = current.getUTCDay();
        if (day === 0) day = 7; // make Sunday = 7

        // calc Monday 00:00 UTC
        const weekStart = new Date(current);
        weekStart.setUTCDate(current.getUTCDate() - (day - 1));
        weekStart.setUTCHours(0, 0, 0, 0);

        const HOURS_IN_WEEK = 7 * 24;
        const log = statusLog.getHourlyStatusLog(weekStart, HOURS_IN_WEEK)
        //console.log(log.toJSON())
        return log.toJSON();
    } catch (err) {
        console.error('[Status Tracker] ERROR:', err);
    }
}

async function getMonthlyStatus() {
  try {
    const statusLog = await getStatusLog();
    const now = new Date();

    const monthStart = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      1, 0, 0, 0, 0
    ));

    const nextMonthStart = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth() + 1,
      1, 0, 0, 0, 0
    ));

    const hours = (nextMonthStart - monthStart) / 3600000;

    const log = statusLog.getHourlyStatusLog(monthStart, hours);

    return log.toJSON();
  } catch (err) {
    console.error('[Status Tracker] ERROR:', err);
    return null;
  }
}

module.exports = { getStatusLog, getLastOnline, getWeeklyStatus, getMonthlyStatus };