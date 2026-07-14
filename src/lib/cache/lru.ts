export class LRUCache<K, V> {
  private cache: Map<K, V>;
  private maxSize: number;

  constructor(maxSize: number) {
    this.cache = new Map();
    this.maxSize = Math.max(1, maxSize);
  }

  isCacheFull(): boolean {
    return this.cache.size >= this.maxSize;
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
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.isCacheFull()) {
      const lruKey = this.cache.keys().next().value;
      if (lruKey !== undefined) {
        this.cache.delete(lruKey);
      }
    }
    this.cache.set(key, value);
  }

  has(key: K): boolean {
    return this.cache.has(key);
  }

  /** Current keys in LRU order (oldest first). Does not affect recency. */
  keys(): IterableIterator<K> {
    return this.cache.keys();
  }

  delete(key: K): boolean {
    return this.cache.delete(key);
  }
}
