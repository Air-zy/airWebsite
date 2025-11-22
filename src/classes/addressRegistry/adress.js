class Address {
  constructor(ip, info = {}) {
    this.ip         = ip;
    this.city       = info.city          || null;
    this.region     = info.region        || null;
    this.isp        = info.isp           || null;
    this.userAgent  = info['user-agent'] || null;
    this.visits     = info.visits        || 0;
    this.captcha    = info.captcha       || 0;
    this.referer    = info.referer       || null;
    this.firstAt    = info.firstAt       || Date.now();
    this.lastAt     = info.lastAt        || this.firstAt;
    this.prevAt     = info.prevAt        || null;
  }

  touch(userAgent, lookupData, refererHeader) {
    this.visits += 1;
    
    this.prevAt = this.lastAt;
    this.lastAt = Date.now();
    
    this.userAgent = userAgent;
    this.city      = lookupData.city;
    this.region    = lookupData.region;
    this.isp       = lookupData.ISP;
    
    if (refererHeader) {
      const clean = refererHeader.replace(/(^\w+:|^)\/\//, '');
      if (!this.referer || clean.startsWith('airzy.glitch.me')) {
        this.referer = refererHeader;
      }
    }
  }

  toJSON() {
    return {
      city:        this.city,
      region:      this.region,
      isp:         this.isp,
      'user-agent':this.userAgent,
      visits:      this.visits,
      captcha:     this.captcha,
      referer:     this.referer,
      firstAt:     this.firstAt,
      lastAt:      this.lastAt,
      prevAt:      this.prevAt,
    };
  }

  static fromRaw(ip, rawInfo) {
    return new Address(ip, rawInfo);
  }
}

module.exports = Address;
