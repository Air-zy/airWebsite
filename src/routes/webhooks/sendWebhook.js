const sleep = ms => new Promise(r => setTimeout(r, ms));

module.exports = async function sendDiscordWebhook(url, body, opts = {}) {
  const { maxRetries = 3, baseBackoffMs = 500 } = opts;
  let attempt = 0;

  while (true) {
    attempt++;

    let res;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch (err) {
      // network error -> exponential backoff retry
      if (attempt > maxRetries) throw err;
      await sleep(baseBackoffMs * 2 ** (attempt - 1));
      continue;
    }

    if (res.ok) return res;

    // rate limited -> respect retry_after / retry-after / x-ratelimit-reset-after
    if (res.status === 429) {
      // try JSON body retry_after first
      let retryMs = null;
      try {
        const j = await res.clone().json().catch(() => null);
        if (j && typeof j.retry_after === 'number') retryMs = Math.ceil(j.retry_after * 1000);
      } catch (e) {}

      if (retryMs == null) {
        const hdr = res.headers.get('retry-after') || res.headers.get('x-ratelimit-reset-after');
        if (hdr) {
          const n = parseFloat(hdr);
          if (!isNaN(n)) retryMs = Math.ceil(n * 1000);
        }
      }

      if (retryMs == null) retryMs = baseBackoffMs * 2 ** (attempt - 1);
      await sleep(retryMs + 50);
      continue;
    }

    // non-retriable auth / not found -> throw immediately
    if ([401, 403, 404].includes(res.status)) {
      const txt = await res.text().catch(() => '<no body>');
      const err = new Error(`Discord webhook failed ${res.status}: ${txt}`);
      err.status = res.status;
      throw err;
    }

    // other errors: retry a few times then throw
    if (attempt > maxRetries) {
      const txt = await res.text().catch(() => '<no body>');
      const err = new Error(`Discord webhook failed ${res.status}: ${txt}`);
      err.status = res.status;
      throw err;
    }

    await sleep(baseBackoffMs * 2 ** (attempt - 1));
  }
};