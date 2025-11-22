const {  
  generateIV,
  keyExpansion,

  pkcs7Unpad,
  pkcs7Pad,

  xorBlocks,
  encryptBlock,
  decryptBlock
} = require('./aes-128_cbc_utils.js');

function encrypt(keyBytes, plaintextBytes) {
  if (!(plaintextBytes instanceof Uint8Array)) plaintextBytes = Uint8Array.from(plaintextBytes);

  const iv = generateIV();
  const expandedKey = keyExpansion(keyBytes);
  const padded      = pkcs7Pad(plaintextBytes);
  const cipherTxt   = new Uint8Array(16 + padded.length);

  cipherTxt.set(iv, 0);
  let prev = iv;
  for (let off = 0; off < padded.length; off += 16) {
    const block = padded.subarray(off, off + 16);
    const xored = xorBlocks(block, prev); // chain
    const enc   = encryptBlock(xored, expandedKey);
    cipherTxt.set(enc, 16 + off);
    prev = enc;
  }
  return cipherTxt;
}

function decrypt(keyBytes, cipherBytes) {
  if (!(cipherBytes instanceof Uint8Array)) cipherBytes = Uint8Array.from(cipherBytes);
  if (cipherBytes.length < 32 || cipherBytes.length % 16 !== 0) {
    throw new Error("cipherTxt must be at least one block plus IV (32 bytes) and a multiple of 16");
  }

  const expandedKey = keyExpansion(keyBytes);

  const iv               = cipherBytes.subarray(0, 16);
  const ciphertextBlocks = cipherBytes.subarray(16);
  const plainTxt         = new Uint8Array(ciphertextBlocks.length);

  let prevCipherBlock = iv;
  for (let offset = 0; offset < ciphertextBlocks.length; offset += 16) {
    const cipherBlock = ciphertextBlocks.subarray(offset, offset + 16);
    const decrypted   = decryptBlock(cipherBlock, expandedKey);
    // unchain
    const plainBlock  = xorBlocks(decrypted, prevCipherBlock);
    plainTxt.set(plainBlock, offset);
    prevCipherBlock = cipherBlock;
  }

  return pkcs7Unpad(plainTxt);
}

module.exports = {
  decrypt,
  encrypt
}