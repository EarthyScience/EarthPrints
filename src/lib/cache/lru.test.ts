import { describe, expect, it } from "vitest";
import { LRUCache } from "@/lib/cache/lru";

describe("LRUCache", () => {
  it("evicts the least recently used entry when full", () => {
    const cache = new LRUCache<string, number>(2);
    cache.set("A", 1);
    cache.set("B", 2);
    cache.get("A");
    cache.set("C", 3);

    expect(cache.get("B")).toBeUndefined();
    expect(cache.get("A")).toBe(1);
    expect(cache.get("C")).toBe(3);
  });

  it("returns falsy values on cache hit", () => {
    const cache = new LRUCache<string, number>(2);
    cache.set("zero", 0);

    expect(cache.get("zero")).toBe(0);
  });

  it("promotes an existing key on set without evicting others", () => {
    const cache = new LRUCache<string, number>(2);
    cache.set("A", 1);
    cache.set("B", 2);
    cache.set("B", 99);

    expect(cache.get("A")).toBe(1);
    expect(cache.get("B")).toBe(99);
  });
});
