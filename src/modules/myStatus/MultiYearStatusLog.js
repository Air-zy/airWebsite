const HourlyStatusLog = require('./HourlyStatusLog.js')
class MultiYearStatusLog {
    constructor() {
        this.byYear = new Map();
    }

    getYearLog(year) {
        if (!this.byYear.has(year)) {
            this.byYear.set(year, HourlyStatusLog.fromYear(year));
        }
        return this.byYear.get(year);
    }

    set(date, isOnline) {
        const d = new Date(date);
        const year = d.getUTCFullYear();
        this.getYearLog(year).set(d, isOnline);
    }

    get(date) {
        const d = new Date(date);
        const year = d.getUTCFullYear();
        return this.getYearLog(year).get(d);
    }

    /**
   * Returns the most recent online hour at or before `beforeDate`.
   * Returns null if no online hour exists.
   */
    getLastOnline(beforeDate = new Date()) {
        const target = new Date(beforeDate);
        const year = target.getUTCFullYear();

        for (let y = year; y >= 0; y--) {
            const log = this.byYear.get(y);
            if (!log) continue;

            const end = y === year ? target : new Date(Date.UTC(y + 1, 0, 1));
            const found = log.getLastOnline(end);
            if (found) return found;
        }

        return null;
    }

    /**
   * Returns a new HourlyStatusLog containing the status for each hour
   * starting at `startDate` for `durationHours` hours.
   * Hours not present in the source logs remain offline.
   */
    getHourlyStatusLog(startDate, durationHours) {
        if (!Number.isInteger(durationHours) || durationHours <= 0) {
            throw new TypeError("durationHours must be a positive integer");
        }

        const start = new Date(startDate);
        if (Number.isNaN(start.getTime())) {
            throw new TypeError("Invalid startDate");
        }

        const result = new HourlyStatusLog(start, durationHours);

        for (let i = 0; i < durationHours; i++) {
            const current = new Date(result.startDate.getTime() + i * 3600000);
            const year = current.getUTCFullYear();
            const yearLog = this.byYear.get(year); // do not auto-create empty years

            if (yearLog && yearLog.get(current)) {
                result.set(current, true);
            }
        }

        return result;
    }

    serialize() {
        const years = {};
        for (const [year, log] of this.byYear) {
            years[year] = log.toJSON();
        }
        return JSON.stringify({ years });
    }

    static deserialize(input) {
        const obj = typeof input === "string" ? JSON.parse(input) : input;
        if (!obj || typeof obj !== "object" || !obj.years) {
            throw new TypeError("Invalid serialized data");
        }

        const wrapper = new MultiYearStatusLog();
        for (const [year, data] of Object.entries(obj.years)) {
            wrapper.byYear.set(Number(year), HourlyStatusLog.deserialize(data));
        }
        return wrapper;
    }
}

module.exports = MultiYearStatusLog