function generateToken(length = 32) {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let token = '';
  for (let i = 0; i < length; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

class Session {
  constructor(id, durationMs = 3600000) {
    this.id = id;
    this.token = generateToken();
    this.createdAt = Date.now();
    this.expiresAt = this.createdAt + durationMs;
  }

  isExpired() {
    return Date.now() > this.expiresAt;
  }

  extend(durationMs) {
    this.expiresAt += durationMs;
  }
}

module.exports = Session;
