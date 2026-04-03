class HourlyStatusLog {
    /**
     * Stores 1 bit per hour starting at `startDate` (UTC hour bucket).
     * 1 = online, 0 = offline / missing
     *
     * @param {Date|string|number} startDate - first hour bucket
     * @param {number} totalHours - number of hourly buckets to store
     */
    constructor(startDate, totalHours) {
        if (!Number.isInteger(totalHours) || totalHours <= 0) {
            throw new TypeError("totalHours must be a positive integer");
        }

        this.startDate = HourlyStatusLog.#toUtcHourStart(new Date(startDate));
        this.totalHours = totalHours;
        this.bytes = new Uint8Array(Math.ceil(totalHours / 8)); // default 0 = offline
    }

    static #toUtcHourStart(date) {
        if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
            throw new TypeError("Invalid date");
        }
        return new Date(Date.UTC(
            date.getUTCFullYear(),
            date.getUTCMonth(),
            date.getUTCDate(),
            date.getUTCHours(),
            0, 0, 0
        ));
    }

    #hourIndexFromDate(date) {
        const d = HourlyStatusLog.#toUtcHourStart(new Date(date));
        const diffMs = d.getTime() - this.startDate.getTime();
        const hourIndex = Math.floor(diffMs / 3600000);

        if (hourIndex < 0 || hourIndex >= this.totalHours) {
            throw new RangeError("Date is outside the stored range");
        }
        return hourIndex;
    }

    #bitLocation(hourIndex) {
        if (!Number.isInteger(hourIndex) || hourIndex < 0 || hourIndex >= this.totalHours) {
            throw new RangeError("hourIndex out of range");
        }
        return {
            byteIndex: hourIndex >> 3,
            bitMask: 1 << (hourIndex & 7),
        };
    }

    set(date, isOnline) {
        const hourIndex = this.#hourIndexFromDate(date);
        const { byteIndex, bitMask } = this.#bitLocation(hourIndex);

        if (isOnline) {
            this.bytes[byteIndex] |= bitMask;
        } else {
            this.bytes[byteIndex] &= ~bitMask;
        }
    }

    get(date) {
        const hourIndex = this.#hourIndexFromDate(date);
        const { byteIndex, bitMask } = this.#bitLocation(hourIndex);
        return (this.bytes[byteIndex] & bitMask) !== 0;
    }

    isOnline(date) {
        return this.get(date);
    }

    isOffline(date) {
        return !this.get(date);
    }

    clear(date) {
        this.set(date, false);
    }

    fillOnline() {
        this.bytes.fill(0xff);

        // clear extra bits beyond totalHours
        const extraBits = (this.bytes.length * 8) - this.totalHours;
        if (extraBits > 0) {
            const last = this.bytes.length - 1;
            this.bytes[last] &= (0xff >>> extraBits);
        }
    }

    fillOffline() {
        this.bytes.fill(0);
    }

    countOnline() {
        let count = 0;
        for (const byte of this.bytes) {
            let b = byte;
            while (b) {
                b &= (b - 1);
                count++;
            }
        }
        return count;
    }

    countOffline() {
        return this.totalHours - this.countOnline();
    }

    forEach(callback) {
        for (let i = 0; i < this.totalHours; i++) {
            const byteIndex = i >> 3;
            const bitMask = 1 << (i & 7);
            const online = (this.bytes[byteIndex] & bitMask) !== 0;
            const date = new Date(this.startDate.getTime() + i * 3600000);
            callback(online, date, i);
        }
    }

    /**
     * Returns the most recent UTC Date at or before `beforeDate`
     * where the status is online. Returns null if none found.
     */
    getLastOnline(beforeDate = new Date()) {
        const target = HourlyStatusLog.#toUtcHourStart(new Date(beforeDate));

        let endIndex = Math.floor(
            (target.getTime() - this.startDate.getTime()) / 3600000
        );

        if (endIndex < 0) return null;
        if (endIndex >= this.totalHours) endIndex = this.totalHours - 1;

        for (let i = endIndex; i >= 0; i--) {
            const byteIndex = i >> 3;
            const bitMask = 1 << (i & 7);

            if ((this.bytes[byteIndex] & bitMask) !== 0) {
                return new Date(this.startDate.getTime() + i * 3600000);
            }
        }

        return null;
    }

    toJSON() {
        return {
            startDate: this.startDate.toISOString(),
            totalHours: this.totalHours,
            data: HourlyStatusLog.#bytesToBase64(this.bytes),
        };
    }

    serialize() {
        return JSON.stringify(this.toJSON());
    }

    static deserialize(input) {
        const obj = typeof input === "string" ? JSON.parse(input) : input;
        if (!obj || !obj.startDate || !obj.totalHours || !obj.data) {
            throw new TypeError("Invalid serialized data");
        }

        const log = new HourlyStatusLog(obj.startDate, obj.totalHours);
        log.bytes = HourlyStatusLog.#base64ToBytes(obj.data, log.bytes.length);
        return log;
    }

    static fromYear(year) {
        const start = new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0));
        const end = new Date(Date.UTC(year + 1, 0, 1, 0, 0, 0, 0));
        const totalHours = Math.round((end - start) / 3600000);
        return new HourlyStatusLog(start, totalHours);
    }

    static #bytesToBase64(bytes) {
        if (typeof Buffer !== "undefined") {
            return Buffer.from(bytes).toString("base64");
        }
        let binary = "";
        for (const b of bytes) binary += String.fromCharCode(b);
        return btoa(binary);
    }

    static #base64ToBytes(base64, expectedLength) {
        let bytes;
        if (typeof Buffer !== "undefined") {
            bytes = Uint8Array.from(Buffer.from(base64, "base64"));
        } else {
            const binary = atob(base64);
            bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) {
                bytes[i] = binary.charCodeAt(i);
            }
        }

        if (expectedLength != null && bytes.length !== expectedLength) {
            throw new Error("Serialized byte length does not match expected size");
        }
        return bytes;
    }
}

module.exports = HourlyStatusLog