const argon2 = require('argon2');

class Account {
    constructor(name) {
        this.uid = null;
        this.name = name;
        this.passwordHash = null;
        this.createdAt = Date.now();
    }

    async setPassword(plainPassword) {
        if (!plainPassword) throw new Error("Password required");
        this.passwordHash = await argon2.hash(plainPassword);
    }

    async verifyPassword(plainPassword) {
        if (!this.passwordHash) return false;
        return await argon2.verifyPassword(this.passwordHash, plainPassword);
    }

    static fromData(data) {
        const acc = new Account(data.name);
        acc.uid = data.uid;
        acc.createdAt = data.createdAt;
        acc.passwordHash = data.passwordHash;
        return acc;
    }

    serialize() {
        return {
            uid: this.uid,
            name: this.name,
            createdAt: this.createdAt,
            passwordHash: this.passwordHash
        };
    }
}

module.exports = Account;