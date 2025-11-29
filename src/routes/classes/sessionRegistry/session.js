function generateToken(length = 32) {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let token = '';
  for (let i = 0; i < length; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return "airzy_" + token;
}

const crypto = require('crypto');
class Session {
  constructor(id, durationMs = 3600000) {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: 'pkcs1',
        format: 'pem'
      },
      privateKeyEncoding: {
        type: 'pkcs1',
        format: 'pem'
      }
    });

    this.id = id;
    this.token = generateToken();
    this.createdAt = Date.now();
    this.expiresAt = this.createdAt + durationMs;

    this.publicKey = publicKey;   // to client
    this.privateKey = privateKey; // secret on server
  }

  isExpired() {
    return Date.now() > this.expiresAt;
  }

  extend(durationMs) {
    this.expiresAt += durationMs;
  }

  decryptMessage(encryptedMessage) {
    return crypto.privateDecrypt(
      {
        key: this.privateKey,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: "sha256"
      },
      Buffer.from(encryptedMessage, 'base64')
    ).toString();
  }

  onlyPublic() {
    return {
      token: this.token,
      publicKey: this.publicKey
    }
  }
}

module.exports = Session;
