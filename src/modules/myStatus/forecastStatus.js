// pseudo counts pulling a sparse weekday hour back to the hour of day average
const SHRINK = 5;

function utcHourStart(date) {
    const d = new Date(date);
    return new Date(Date.UTC(
        d.getUTCFullYear(),
        d.getUTCMonth(),
        d.getUTCDate(),
        d.getUTCHours(),
        0, 0, 0, 0
    ));
}

function sortedYears(multiYear) {
    return [...multiYear.byYear.keys()].sort((a, b) => a - b);
}

function analyze(multiYear) {
    const dateNow = utcHourStart(Date.now());

    let totalHours = 0;
    let firstOnline = null;

    const hourCounts = {};
    const dayStats = {};

    for (let h = 0; h < 24; h++) {
        hourCounts[h] = { online: 0, total: 0 };
    }

    for (let d = 0; d < 7; d++) {
        dayStats[d] = {
            total: 0,
            online: 0,
            hourCounts: {}
        };

        for (let h = 0; h < 24; h++) {
            dayStats[d].hourCounts[h] = { online: 0, total: 0 };
        }
    }

    for (const year of sortedYears(multiYear)) {
        const log = multiYear.byYear.get(year);
        if (!log) continue;

        log.forEach((online, date) => {
            if (date > dateNow) return;

            const hour = date.getUTCHours();
            const day = date.getUTCDay();

            if (online) {
                totalHours++;
                hourCounts[hour].online++;
                dayStats[day].online++;
                dayStats[day].hourCounts[hour].online++;

                if (!firstOnline || date < firstOnline) {
                    firstOnline = date;
                }
            }

            if (firstOnline != null) { // only count data after first online
                hourCounts[hour].total++;
                dayStats[day].total++;
                dayStats[day].hourCounts[hour].total++;
            }
        });
    }

    const byHourOfDay = {};
    for (let h = 0; h < 24; h++) {
        const stat = hourCounts[h];
        byHourOfDay[h] = stat.total ? stat.online / stat.total : 0;
    }

    const byDayOfWeek = {};
    for (let d = 0; d < 7; d++) {
        const day = dayStats[d];
        const byHour = {};

        // a weekday hour gets one sample a week, so shrink it toward the hour of day marginal (7x the data)
        for (let h = 0; h < 24; h++) {
            const stat = day.hourCounts[h];
            byHour[h] = (stat.online + SHRINK * byHourOfDay[h]) / (stat.total + SHRINK);
        }

        byDayOfWeek[d] = {
            total: day.total,
            online: day.online,
            byHourOfDay: byHour,
        };
    }

    return {
        dateNow: dateNow.toISOString(),
        firstOnline: firstOnline ? firstOnline.toISOString() : null,
        totalHours,
        byHourOfDay,
        byDayOfWeek,
    };
}

// hours from the current one until the odds of having come back pass half, null if not within a week.
// ponytail: treats hours as independent, so a long absence (asleep, away) reads optimistic
function backIn(analysis, from = Date.now()) {
    const start = utcHourStart(from).getTime();
    let miss = 1;

    for (let k = 0; k < 168; k++) {
        const t = new Date(start + k * 3600000);
        miss *= 1 - analysis.byDayOfWeek[t.getUTCDay()].byHourOfDay[t.getUTCHours()];
        if (miss <= 0.5) return k;
    }
    return null;
}

module.exports = {
    analyze,
    backIn
};