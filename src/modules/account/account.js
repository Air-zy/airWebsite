const argon2 = require('argon2');
const sessionManager = require('../../routes/classes/sessionRegistry/sessionManager.js');

class Account {
    constructor(name) {
        this.uid = null;
        this.name = name;
        this.passwordHash = null;
        this.createdAt = Date.now();
        this.currentSession = null;
    }

    //

    async setPassword(plainPassword) {
        if (!plainPassword) throw new Error("Password required");
        this.passwordHash = await argon2.hash(plainPassword);
    }

    async verifyPassword(plainPassword) {
        if (!this.passwordHash) return false;
        return await argon2.verify(this.passwordHash, plainPassword);
    }

    //

    loginSession() {
        const session = sessionManager.createSession()
        session.onlyPublic();
        this.currentSession = session;
        return session;
    }

    //

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