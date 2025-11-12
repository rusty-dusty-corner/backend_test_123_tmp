type Bucket = {
  remaining: number;
  resetAt: number;
};

export class TokenRateLimiter {
  private readonly buckets = new Map<string, Bucket>();

  constructor(
    private readonly capacity: number,
    private readonly windowMs: number,
  ) {}

  consume(key: string): boolean {
    const now = Date.now();
    const bucket = this.buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      this.buckets.set(key, {
        remaining: this.capacity - 1,
        resetAt: now + this.windowMs,
      });
      return true;
    }

    if (bucket.remaining <= 0) {
      return false;
    }

    bucket.remaining -= 1;
    return true;
  }
}
