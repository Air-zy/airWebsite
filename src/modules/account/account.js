const argon2 = require('argon2');

class Account {
    constructor(name, email) {
        this.uid = null;
        this.name = name;
        this.email = email;
        this.passwordHash = null;
        this.createdAt = Date.now();
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

    // doc id is the source of truth for uid, the field used to be written as null
    static fromData(data, id) {
        const acc = new Account(data.name, data.email);
        acc.uid = Number(id);
        acc.createdAt = data.createdAt;
        acc.passwordHash = data.passwordHash;
        return acc;
    }

    serialize() {
        return {
            uid: this.uid,
            name: this.name,
            email: this.email,
            createdAt: this.createdAt,
            passwordHash: this.passwordHash
        };
    }
}

module.exports = Account;
