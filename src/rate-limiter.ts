interface Entry {
  count: number;
  resetAt: number;
}

export class RateLimiter {
  private readonly entries = new Map<string, Entry>();
  private operations = 0;

  public constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly maxEntries = 10_000,
  ) {}

  public isLimited(key: string, now = Date.now()): boolean {
    this.operations += 1;
    if (this.operations % 100 === 0) this.prune(now);
    const entry = this.entries.get(key);
    if (!entry || now >= entry.resetAt) {
      if (!entry && this.entries.size >= this.maxEntries) {
        this.prune(now);
        if (this.entries.size >= this.maxEntries) return true;
      }
      this.entries.set(key, { count: 1, resetAt: now + this.windowMs });
      return false;
    }
    entry.count += 1;
    return entry.count > this.limit;
  }

  private prune(now: number): void {
    for (const [key, entry] of this.entries) {
      if (now >= entry.resetAt) this.entries.delete(key);
    }
  }
}
