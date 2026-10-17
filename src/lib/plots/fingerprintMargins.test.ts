import { describe, expect, it } from "vitest";
import {
  bandRange,
  fingerprintMargins,
  niceTicks,
} from "@/lib/plots/fingerprintMargins";

describe("fingerprintMargins", () => {
  // Three columns of two hours: [1, 3], [5, NaN], [NaN, NaN]
  const cells = new Float32Array([1, 3, 5, NaN, NaN, NaN]);
  const { byColumn, byHour } = fingerprintMargins(cells, 3, 2);

  it("summarises each column over its hours", () => {
    expect(Array.from(byColumn.mean.slice(0, 2))).toEqual([2, 5]);
    expect(Array.from(byColumn.std.slice(0, 2))).toEqual([1, 0]);
    expect(Array.from(byColumn.count)).toEqual([2, 1, 0]);
    expect(byColumn.mean[2]).toBeNaN();
  });

  it("summarises each hour over the columns, skipping gaps", () => {
    expect(Array.from(byHour.mean)).toEqual([3, 3]);
    expect(Array.from(byHour.std)).toEqual([2, 0]);
    expect(Array.from(byHour.count)).toEqual([2, 1]);
  });
});

describe("bandRange", () => {
  it("covers the band and zero", () => {
    const stats = {
      mean: new Float32Array([2, 4, NaN]),
      std: new Float32Array([1, 1, NaN]),
      count: new Uint32Array([1, 1, 0]),
    };
    expect(bandRange(stats)).toEqual([0, 5]);
  });

  it("opens up a flat range", () => {
    const stats = {
      mean: new Float32Array([0]),
      std: new Float32Array([0]),
      count: new Uint32Array([1]),
    };
    expect(bandRange(stats)).toEqual([-1, 1]);
  });
});

describe("niceTicks", () => {
  it("picks round steps that include zero", () => {
    expect(niceTicks(-12.3, 4.1)).toEqual([-10, 0]);
    expect(niceTicks(-12.3, 4.1, 5)).toEqual([-10, -5, 0]);
    expect(niceTicks(0, 1)).toEqual([0, 0.5, 1]);
    expect(niceTicks(-0.3, 0.2)).toEqual([-0.25, 0]);
    expect(niceTicks(-9, 1)).toEqual([-5, 0]);
    expect(niceTicks(-17, 6)).toEqual([-10, 0]);
  });
});
