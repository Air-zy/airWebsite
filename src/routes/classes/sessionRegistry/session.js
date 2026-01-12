const crypto = require('crypto');

function generateToken(length = 32) {
  const token = crypto.randomBytes(length).toString('base64url'); // safe URL-friendly string
  return "airzy_" + token;
}

class Session {
  constructor(durationMs = 3600000) {
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

    this.token = generateToken();
    this.createdAt = Date.now();
    this.expiresAt = this.createdAt + durationMs;

    this.publicKey = publicKey;   // to client
    this.privateKey = privateKey; // secret on server

    this.accUID = null;
  }

  setAccUID(uid) {
    this.accUID = uid;
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
      expiresAt: this.expiresAt,
      publicKey: this.publicKey,
    }
  }
}

module.exports = Session;
