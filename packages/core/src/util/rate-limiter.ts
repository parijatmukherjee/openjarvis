interface TokenBucket {
  tokens: number;
  lastRefill: number;
  resetAt: number;
}

const buckets = new Map<string, TokenBucket>();

export interface TokenBucketOptions {
  capacity: number;
  refillRate: number; // tokens per second
  maxAgeMs?: number;
}

const DEFAULT_MAX_AGE_MS = 86_400_000;

function cleanupBuckets(): void {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (now > bucket.resetAt) {
      buckets.delete(key);
    }
  }
}

/** Calculate exponential backoff with full jitter for a given attempt. */
export function calculateBackoff(attempt: number, baseMs: number): number {
  const interval = baseMs * 2 ** attempt;
  return interval + Math.floor(Math.random() * interval);
}

export function tokenBucket(key: string, opts: TokenBucketOptions): { allow(): boolean } {
  const maxAgeMs = opts.maxAgeMs ?? DEFAULT_MAX_AGE_MS;
  return {
    allow(): boolean {
      const now = Date.now();
      cleanupBuckets();
      let bucket = buckets.get(key);
      if (!bucket) {
        bucket = { tokens: opts.capacity, lastRefill: now, resetAt: now + maxAgeMs };
        buckets.set(key, bucket);
      }
      const elapsed = (now - bucket.lastRefill) / 1000;
      bucket.tokens = Math.min(opts.capacity, bucket.tokens + elapsed * opts.refillRate);
      bucket.lastRefill = now;
      bucket.resetAt = now + maxAgeMs;
      if (bucket.tokens >= 1) {
        bucket.tokens -= 1;
        return true;
      }
      return false;
    },
  };
}
