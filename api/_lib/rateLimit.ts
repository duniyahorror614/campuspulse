/**
 * In-memory sliding window rate limiter per client IP.
 * Best-effort on serverless instances.
 */

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export class SlidingWindowRateLimiter {
  private readonly windowMs: number;
  private readonly maxRequests: number;
  private readonly hits: Map<string, number[]>;

  constructor(maxRequests: number, windowMs = 60_000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this.hits = new Map();
  }

  public check(ip: string, now = Date.now()): RateLimitResult {
    const windowStart = now - this.windowMs;
    let timestamps = this.hits.get(ip);

    if (!timestamps) {
      timestamps = [];
      this.hits.set(ip, timestamps);
    }

    // Filter out timestamps outside the active window
    const valid = timestamps.filter((t) => t > windowStart);
    this.hits.set(ip, valid);

    if (valid.length >= this.maxRequests) {
      const oldestValid = valid[0];
      const retryAfterSeconds = Math.max(1, Math.ceil((oldestValid + this.windowMs - now) / 1000));
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds,
      };
    }

    valid.push(now);
    return {
      allowed: true,
      remaining: this.maxRequests - valid.length,
      retryAfterSeconds: 0,
    };
  }

  public reset(): void {
    this.hits.clear();
  }
}

// 10 requests per minute for extraction
export const extractRateLimiter = new SlidingWindowRateLimiter(10, 60_000);

// 5 requests per minute for summary
export const summaryRateLimiter = new SlidingWindowRateLimiter(5, 60_000);
