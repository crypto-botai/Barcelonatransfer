/**
 * Rate limiting for /api/v1.
 *
 * The limiter is an interface so the store can change without touching a route.
 * The in-memory version below counts per server instance. On Vercel, instances
 * come and go and run side by side, so it is a floor (it stops a runaway loop on
 * one instance) and not a guarantee. Before the apps ship, a shared store
 * (Redis or Vercel KV) implements the same interface and replaces it through
 * setRateLimiter. Sign-in, token refresh and password reset must use the shared
 * store, with the stricter limits below.
 */

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  /** Seconds until the window resets. */
  retryAfterSeconds: number;
}

export interface RateLimiter {
  hit(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult>;
}

/** Starting limits per caller. Tune with real traffic. */
export const RATE_LIMITS = {
  /** Public reads such as app-config and health. */
  publicRead: { limit: 120, windowSeconds: 60 },
  /** Authenticated reads and writes. */
  authenticated: { limit: 240, windowSeconds: 60 },
  /** Sign-in, sign-up, forgot password. Keyed by IP and by account, both must pass. */
  credentials: { limit: 5, windowSeconds: 60 },
  /** Token refresh. */
  refresh: { limit: 30, windowSeconds: 60 },
  /** Driver GPS ingest: one fix every few seconds, with headroom for batches. */
  tracking: { limit: 60, windowSeconds: 60 },
} as const;

export class MemoryRateLimiter implements RateLimiter {
  private readonly buckets = new Map<string, { count: number; resetAt: number }>();

  constructor(
    private readonly now: () => number = Date.now,
    private readonly maxKeys = 10_000,
  ) {}

  async hit(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
    const t = this.now();
    let bucket = this.buckets.get(key);
    if (!bucket || bucket.resetAt <= t) {
      if (this.buckets.size >= this.maxKeys) this.sweep(t);
      bucket = { count: 0, resetAt: t + windowSeconds * 1000 };
      this.buckets.set(key, bucket);
    }
    bucket.count += 1;
    const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - t) / 1000));
    return { allowed: bucket.count <= limit, remaining: Math.max(0, limit - bucket.count), retryAfterSeconds };
  }

  /** Drops expired buckets, and everything if that is not enough, so memory stays bounded. */
  private sweep(t: number): void {
    for (const [k, b] of this.buckets) if (b.resetAt <= t) this.buckets.delete(k);
    if (this.buckets.size >= this.maxKeys) this.buckets.clear();
  }
}

let limiter: RateLimiter = new MemoryRateLimiter();

export function setRateLimiter(next: RateLimiter): void {
  limiter = next;
}

export function getRateLimiter(): RateLimiter {
  return limiter;
}

/** The caller's address as the platform reports it, or "unknown". Used only as a limiter key. */
export function clientAddress(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || req.headers.get("x-real-ip") || "unknown";
}
