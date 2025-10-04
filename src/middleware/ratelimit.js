let tokens = 20; // global bucket
const refillRate = 10; // tokens per second
const maxTokens = 20;

// global refill
setInterval(() => {
  tokens = Math.min(tokens + refillRate, maxTokens);
}, 1000);

// per-client buckets
const clientBuckets = {};
const clientRefillRate = 0.4;
const clientMaxTokens = 10;

// per-client refill
setInterval(() => {
  for (const ip in clientBuckets) {
    clientBuckets[ip] = Math.min(clientBuckets[ip] + clientRefillRate, clientMaxTokens);
  }
}, 1000);

function getIP(req) {
  const ipList = req.headers['x-forwarded-for'];
  if (ipList) {
    const ips = ipList.split(',');
    return ips[0].trim();
  }
  return req.connection?.remoteAddress ||
         req.socket?.remoteAddress ||
         req.connection?.socket?.remoteAddress ||
         null;
}

module.exports = (req, res, next) => {
  const ip = getIP(req) || "unknown";

  // ensure bucket exists
  if (!(ip in clientBuckets)) {
    clientBuckets[ip] = clientMaxTokens;
  }

  // check global first
  if (tokens <= 0) {
    return res.status(429).end();
  }

  // check per-client
  if (clientBuckets[ip] <= 0) {
    return res.status(429).end();
  }

  // consume
  tokens--;
  clientBuckets[ip]--;
  next();
};
