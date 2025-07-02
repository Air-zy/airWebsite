import { base64Encode, base64Decode } from './base64module.js';
import { encrypt as aesEncryptBlock, decrypt as aesDecryptBlock } from './aes-128_cbc.js';

function base64ToBytes(b64) {
  return base64Decode(b64);
}

function bytesToBase64(bytes) {
  return base64Encode(bytes);
}

function getKeyBytesFromBase64(keyB64) {
  const keyBytes = base64Decode(keyB64.trim());
  if (keyBytes.length !== 16) {
    throw new Error("Key must decode to exactly 16 bytes.");
  }
  return keyBytes;
}

window.generateKey = function () {
  const keyBytes = crypto.getRandomValues(new Uint8Array(16));
  document.getElementById("aes-key").value = bytesToBase64(keyBytes);
};

window.runAesEncrypt = function () {
  const keyBase64 = document.getElementById("aes-key").value;
  const plaintext = document.getElementById("aes-plaintext").value;
  const output = document.getElementById("aes-ciphertext");
  const timing = document.getElementById("aes-timing");

  const start = performance.now();

  try {
    const keyBytes = getKeyBytesFromBase64(keyBase64);
    const plainBytes = new TextEncoder().encode(plaintext);
    const cipherBytes = aesEncryptBlock(keyBytes, plainBytes);
    const cipherB64 = bytesToBase64(cipherBytes);

    output.value = cipherB64;
    const end = performance.now();
    timing.textContent = `Encryption took ${(end - start).toFixed(2)} ms`;
  } catch (err) {
    output.value = "";
    timing.textContent = `Encryption error: ${err.message}`;
  }
};

window.runAesDecrypt = function () {
  const keyBase64 = document.getElementById("aes-key").value;
  const cipherTextB64 = document.getElementById("aes-ciphertext-in").value;
  const output = document.getElementById("aes-decrypted");
  const timing = document.getElementById("aes-timing");

  const start = performance.now();

  try {
    const keyBytes = getKeyBytesFromBase64(keyBase64);
    const cipherBytes = base64ToBytes(cipherTextB64.trim());
    const plainBytes = aesDecryptBlock(keyBytes, cipherBytes);
    const plaintext = new TextDecoder().decode(plainBytes);

    output.value = plaintext;
    const end = performance.now();
    timing.textContent = `Decryption took ${(end - start).toFixed(2)} ms`;
  } catch (err) {
    output.value = "";
    timing.textContent = `Decryption error: ${err.message}`;
  }
};
