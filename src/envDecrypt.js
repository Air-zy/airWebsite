const { decrypt } = require('./aes-128_ecb.js');

function envDecrypt(key, ciphertext) {
  keyBytes = Buffer.from(key, 'base64');
  const cipherBuf = Buffer.from(ciphertext, 'base64');

  const plainBytes = decrypt(
    new Uint8Array(keyBytes),
    new Uint8Array(cipherBuf)
  );

  return Buffer.from(plainBytes).toString('utf8');
}

module.exports = envDecrypt;
