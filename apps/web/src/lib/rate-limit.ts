// Very small in-memory sliding-window rate limiter.
// Good enough for single-instance dev/prod; for horizontal scaling, swap for Redis.

type Key = string;
const buckets = new Map<Key, number[]>();

export function rateLimit(
  key: Key,
  { limit, windowMs }: { limit: number; windowMs: number },
): { ok: boolean; retryAfterSec: number } {
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= limit) {
    const oldest = hits[0] ?? now;
    const retryAfterSec = Math.max(1, Math.ceil((windowMs - (now - oldest)) / 1000));
    return { ok: false, retryAfterSec };
  }
  hits.push(now);
  buckets.set(key, hits);
  return { ok: true, retryAfterSec: 0 };
}

// Periodic cleanup to avoid unbounded growth.
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const cutoff = Date.now() - 10 * 60 * 1000;
    for (const [k, v] of buckets) {
      const kept = v.filter((t) => t >= cutoff);
      if (kept.length === 0) buckets.delete(k);
      else buckets.set(k, kept);
    }
  }, 5 * 60 * 1000).unref?.();
}
