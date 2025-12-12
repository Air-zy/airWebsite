const crypto = require('crypto');

class Account {
  constructor(name) {
    this.name = name;
    this.createdAt = Date.now();
    this.expiresAt = this.createdAt + durationMs;
  }
}

module.exports = Account;
