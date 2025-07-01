const { decrypt } = require('./aes-128_ecb.js');

function envDecrypt(key, ciphertext) {
  console.log("[AIR_SYSTEM REQUEST FOR] ", key)
  if (key == null) {
    throw new Error("envDecrypt error: `key` is null or undefined");
  }
  if (ciphertext == null) {
    throw new Error("envDecrypt error: `ciphertext` is null or undefined");
  }
  if (typeof key !== "string" || key.trim() === "") {
    throw new Error("envDecrypt error: `key` must be a non-empty Base64 string");
  }
  if (typeof ciphertext !== "string" || ciphertext.trim() === "") {
    throw new Error("envDecrypt error: `ciphertext` must be a non-empty Base64 string");
  }
  
  keyBytes = Buffer.from(key, 'base64');
  const cipherBuf = Buffer.from(ciphertext, 'base64');

  const plainBytes = decrypt(
    new Uint8Array(keyBytes),
    new Uint8Array(cipherBuf)
  );

  return Buffer.from(plainBytes).toString('utf8');
}

module.exports = envDecrypt;
