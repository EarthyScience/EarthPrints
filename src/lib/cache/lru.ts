export type LRUCacheOptions<V> = {
  /** Byte budget across all entries. Defaults to unbounded. */
  maxBytes?: number;
  /** Size of one value in bytes. Required for `maxBytes` to do anything. */
  weigh?: (value: V) => number;
};

export class LRUCache<K, V> {
  private cache = new Map<K, V>();
  private weights = new Map<K, number>();
  private maxSize: number;
  private maxBytes: number;
  private weigh: ((value: V) => number) | null;
  private totalBytes = 0;

  /**
   * Bounded by entry count, and optionally by total bytes as well.
   *
   * Counting entries is only a fair proxy for memory while entries are a
   * similar size. Callers holding values that differ by orders of magnitude
   * (a decoded Zarr chunk is ~224 MB) should pass a byte budget instead of
   * trying to express that budget as a number of entries.
   */
  constructor(maxSize: number, options: LRUCacheOptions<V> = {}) {
    this.maxSize = Math.max(1, maxSize);
    this.maxBytes = options.maxBytes ?? Number.POSITIVE_INFINITY;
    this.weigh = options.weigh ?? null;
  }

  isCacheFull(): boolean {
    return this.cache.size >= this.maxSize || this.totalBytes >= this.maxBytes;
  }

  /** Bytes currently held, or 0 when the cache is not weighing values. */
  byteSize(): number {
    return this.totalBytes;
  }

  get(key: K): V | undefined {
    if (!this.cache.has(key)) {
      return undefined;
    }
    const value = this.cache.get(key)!;
    this.cache.delete(key);
    this.cache.set(key, value);
    return value;
  }

  set(key: K, value: V): void {
    // Delete first so a re-set moves the key to the most-recent end and its
    // old weight is discounted before the new one is added.
    this.delete(key);
    this.cache.set(key, value);

    if (this.weigh) {
      const weight = this.weigh(value);
      this.weights.set(key, weight);
      this.totalBytes += weight;
    }

    this.evict();
  }

  has(key: K): boolean {
    return this.cache.has(key);
  }

  delete(key: K): boolean {
    const weight = this.weights.get(key);
    if (weight !== undefined) {
      this.totalBytes -= weight;
      this.weights.delete(key);
    }
    return this.cache.delete(key);
  }

  private evict(): void {
    // Stop at one entry even if it alone exceeds the byte budget: holding a
    // single oversized value beats evicting it on arrival and never serving
    // a hit at all.
    while (
      this.cache.size > 1 &&
      (this.cache.size > this.maxSize || this.totalBytes > this.maxBytes)
    ) {
      const lruKey = this.cache.keys().next().value;
      if (lruKey === undefined) return;
      this.delete(lruKey);
    }
  }
}
