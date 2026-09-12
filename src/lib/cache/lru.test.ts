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

  it("checks key presence without promoting", () => {
    const cache = new LRUCache<string, number>(2);
    cache.set("A", 1);
    cache.set("B", 2);

    expect(cache.has("A")).toBe(true);
    cache.set("C", 3);

    expect(cache.get("A")).toBeUndefined();
  });

  it("deletes a cached entry", () => {
    const cache = new LRUCache<string, number>(2);
    cache.set("A", 1);

    expect(cache.delete("A")).toBe(true);
    expect(cache.get("A")).toBeUndefined();
  });

  it("clamps maxSize to at least 1", () => {
    const cache = new LRUCache<string, number>(0);
    cache.set("A", 1);

    expect(cache.get("A")).toBe(1);
  });
});

describe("LRUCache byte budget", () => {
  const weigh = (value: Float32Array) => value.byteLength;
  // 4 floats = 16 bytes each, so a 40-byte budget holds two and not three.
  const block = (fill: number) => Float32Array.from([fill, fill, fill, fill]);

  it("evicts by bytes before the entry count is reached", () => {
    const cache = new LRUCache<string, Float32Array>(100, {
      maxBytes: 40,
      weigh,
    });
    cache.set("a", block(1));
    cache.set("b", block(2));
    cache.set("c", block(3));

    expect(cache.has("a")).toBe(false);
    expect(cache.has("b")).toBe(true);
    expect(cache.has("c")).toBe(true);
    expect(cache.byteSize()).toBe(32);
  });

  it("discounts the old weight when a key is overwritten", () => {
    const cache = new LRUCache<string, Float32Array>(100, {
      maxBytes: 40,
      weigh,
    });
    cache.set("a", new Float32Array(8)); // 32 bytes
    cache.set("a", block(1)); // 16 bytes

    expect(cache.byteSize()).toBe(16);
    expect(cache.has("a")).toBe(true);
  });

  it("frees bytes on delete", () => {
    const cache = new LRUCache<string, Float32Array>(100, {
      maxBytes: 40,
      weigh,
    });
    cache.set("a", block(1));
    cache.delete("a");

    expect(cache.byteSize()).toBe(0);
  });

  it("keeps a value larger than the whole budget rather than dropping it", () => {
    const cache = new LRUCache<string, Float32Array>(100, {
      maxBytes: 8,
      weigh,
    });
    cache.set("a", block(1)); // 16 bytes, over budget on its own

    expect(cache.get("a")).toEqual(block(1));
  });

  it("evicts by the recency of use, not of insertion", () => {
    const cache = new LRUCache<string, Float32Array>(100, {
      maxBytes: 40,
      weigh,
    });
    cache.set("a", block(1));
    cache.set("b", block(2));
    cache.get("a");
    cache.set("c", block(3));

    expect(cache.has("a")).toBe(true);
    expect(cache.has("b")).toBe(false);
  });

  it("counts no bytes without a weigh function", () => {
    const cache = new LRUCache<string, Float32Array>(2);
    cache.set("a", block(1));

    expect(cache.byteSize()).toBe(0);
    expect(cache.has("a")).toBe(true);
  });
});
