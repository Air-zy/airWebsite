const HourlyStatusLog = require("./HourlyStatusLog");

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

        for (let h = 0; h < 24; h++) {
            const stat = day.hourCounts[h];
            byHour[h] = stat.total ? stat.online / stat.total : 0;
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

module.exports = {
    analyze
};