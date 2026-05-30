interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class MemCache<T> {
  private store = new Map<string, CacheEntry<T>>();

  set(key: string, value: T, ttlMs: number) {
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  get(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) { this.store.delete(key); return undefined; }
    return entry.value;
  }

  del(key: string) { this.store.delete(key); }

  clear() { this.store.clear(); }
}

export class RateLimiter {
  private hits = new Map<string, number[]>();

  constructor(private maxHits: number, private windowMs: number) {}

  isAllowed(key: string): boolean {
    const now = Date.now();
    const cutoff = now - this.windowMs;
    const times = (this.hits.get(key) ?? []).filter(t => t > cutoff);
    if (times.length >= this.maxHits) return false;
    times.push(now);
    this.hits.set(key, times);
    return true;
  }
}
