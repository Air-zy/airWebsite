const crypto = require('crypto');

const base64chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
function base64Encode(e) {
    let s, c = "";
    for (s = 0; s < e.length; s += 3) {
        const [a,r=0,n=0] = e.slice(s, s + 3)
          , t = 3 - (e.length - s)
          , o = a << 16 | r << 8 | n;
        c += base64chars[o >> 18 & 63],
        c += base64chars[o >> 12 & 63],
        c += t >= 2 ? "=" : base64chars[o >> 6 & 63],
        c += t >= 1 ? "=" : base64chars[63 & o]
    }
    return c
}
function base64Decode(e) {
    const s = [];
    let c = 0
      , a = 0;
    for (const r of e.replace(/=+$/, ""))
        c = c << 6 | base64chars.indexOf(r),
        a += 6,
        a >= 8 && (a -= 8,
        s.push(c >> a & 255));
    return s
}

function generateKey() {
    const e = crypto.getRandomValues(new Uint8Array(16));
    base64Encode(e)
}

class Account {
  constructor(name) {
    this.name = name;
    this.createdAt = Date.now();
    this.aesKey = generateKey();
  }
}

module.exports = Account;
