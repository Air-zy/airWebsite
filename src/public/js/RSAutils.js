// Browser-side RSA-OAEP (SHA-256) encryptor supporting both SPKI and PKCS#1 PEM public keys.

function pemToArrayBuffer(pem) {
  const b64 = pem
    .replace(/-----BEGIN [^-]+-----/, '')
    .replace(/-----END [^-]+-----/, '')
    .replace(/\s+/g, '');
  const binary = atob(b64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function readLength(bytes, offset) {
  let len = bytes[offset];
  if ((len & 0x80) === 0) {
    return { length: len, lengthBytes: 1 };
  }
  const n = len & 0x7f;
  let value = 0;
  for (let i = 0; i < n; i++) {
    value = (value << 8) | bytes[offset + 1 + i];
  }
  return { length: value, lengthBytes: 1 + n };
}

function parsePkcs1PublicKey(arrayBuffer) {
  // PKCS#1 RSAPublicKey ::= SEQUENCE { modulus INTEGER, exponent INTEGER }
  const bytes = new Uint8Array(arrayBuffer);
  let idx = 0;
  if (bytes[idx++] !== 0x30) throw new Error('Invalid PKCS#1: no SEQUENCE');
  const seqLen = readLength(bytes, idx);
  idx += seqLen.lengthBytes;

  if (bytes[idx++] !== 0x02) throw new Error('Invalid PKCS#1: expected INTEGER (modulus)');
  const modLen = readLength(bytes, idx);
  idx += modLen.lengthBytes;
  let modulus = bytes.slice(idx, idx + modLen.length);
  idx += modLen.length;

  if (bytes[idx++] !== 0x02) throw new Error('Invalid PKCS#1: expected INTEGER (exponent)');
  const expLen = readLength(bytes, idx);
  idx += expLen.lengthBytes;
  let exponent = bytes.slice(idx, idx + expLen.length);

  // remove possible leading zero byte
  if (modulus[0] === 0x00) modulus = modulus.slice(1);
  if (exponent[0] === 0x00) exponent = exponent.slice(1);

  return { modulus, exponent };
}

function uint8ToBase64(u8) {
  const CHUNK = 0x8000;
  let str = '';
  for (let i = 0; i < u8.length; i += CHUNK) {
    str += String.fromCharCode.apply(null, Array.from(u8.subarray(i, i + CHUNK)));
  }
  return btoa(str);
}

function toBase64Url(u8) {
  return uint8ToBase64(u8).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function arrayBufferToBase64(buffer) {
  const u8 = new Uint8Array(buffer);
  return uint8ToBase64(u8);
}

/**
 * Encrypt a string with an RSA public key PEM (SPKI or PKCS#1).
 * @param {string} pem - the PEM public key (including header/footer).
 * @param {string} message - plaintext string to encrypt.
 * @returns {Promise<string>} base64-encoded ciphertext
 */
export async function encryptWithPublicKey(pem, message) {
  if (typeof window === 'undefined' || !window.crypto || !window.crypto.subtle) {
    throw new Error('SubtleCrypto required (modern browser).');
  }

  // SPKI (BEGIN PUBLIC KEY) can be imported directly
  if (pem.includes('-----BEGIN PUBLIC KEY-----')) {
    const spki = pemToArrayBuffer(pem);
    const key = await crypto.subtle.importKey(
      'spki',
      spki,
      { name: 'RSA-OAEP', hash: 'SHA-256' },
      false,
      ['encrypt']
    );
    const encoded = new TextEncoder().encode(message);
    const cipher = await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, key, encoded);
    return arrayBufferToBase64(cipher);
  }

  // PKCS#1 (BEGIN RSA PUBLIC KEY) -> parse modulus & exponent -> import as JWK
  if (pem.includes('-----BEGIN RSA PUBLIC KEY-----')) {
    const der = pemToArrayBuffer(pem);
    const { modulus, exponent } = parsePkcs1PublicKey(der);
    const jwk = {
      kty: 'RSA',
      n: toBase64Url(modulus),
      e: toBase64Url(exponent),
      alg: 'RSA-OAEP-256',
      ext: true
    };
    const key = await crypto.subtle.importKey(
      'jwk',
      jwk,
      { name: 'RSA-OAEP', hash: 'SHA-256' },
      false,
      ['encrypt']
    );
    const encoded = new TextEncoder().encode(message);
    const cipher = await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, key, encoded);
    return arrayBufferToBase64(cipher);
  }

  throw new Error('Unrecognized PEM format (expecting SPKI "BEGIN PUBLIC KEY" or PKCS#1 "BEGIN RSA PUBLIC KEY").');
}