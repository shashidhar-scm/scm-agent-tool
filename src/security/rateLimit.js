export function createRateLimiter({ windowSeconds, max }) {
  const rateBuckets = new Map();

  return function rateLimit(apiKey, ip) {
    if (!Number.isFinite(windowSeconds) || windowSeconds <= 0) return;
    if (!Number.isFinite(max) || max <= 0) return;

    const now = Date.now();
    const windowMs = windowSeconds * 1000;
    const windowId = Math.floor(now / windowMs);
    const bucketKey = `${apiKey}|${ip}|${windowId}`;

    if (rateBuckets.size > 10_000) {
      for (const k of rateBuckets.keys()) {
        const parts = String(k).split("|");
        const wid = Number(parts[2]);
        if (Number.isFinite(wid) && wid < windowId - 2) rateBuckets.delete(k);
      }
    }

    const n = (rateBuckets.get(bucketKey) ?? 0) + 1;
    rateBuckets.set(bucketKey, n);
    if (n > max) {
      const err = new Error("rate_limited");
      err.statusCode = 429;
      throw err;
    }
  };
}
