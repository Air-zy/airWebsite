const base64chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

export function base64Encode(bytes) {
  let result = "", i;
  for (i = 0; i < bytes.length; i += 3) {
    const [b1, b2 = 0, b3 = 0] = bytes.slice(i, i + 3);
    const pad = 3 - (bytes.length - i);
    const n = (b1 << 16) | (b2 << 8) | b3;
    result += base64chars[(n >> 18) & 63];
    result += base64chars[(n >> 12) & 63];
    result += pad >= 2 ? "=" : base64chars[(n >> 6) & 63];
    result += pad >= 1 ? "=" : base64chars[n & 63];
  }
  return result;
}

export function base64Decode(str) {
  const bytes = [];
  let buffer = 0, bits = 0;
  for (const char of str.replace(/=+$/, '')) {
    buffer = (buffer << 6) | base64chars.indexOf(char);
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xFF);
    }
  }
  return bytes;
}
