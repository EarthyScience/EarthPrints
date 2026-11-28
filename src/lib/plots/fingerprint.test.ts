import { describe, expect, it } from "vitest";
import {
  fingerprintGrid,
  type FingerprintLayout,
  type FingerprintTarget,
  fingerprintTargetAt,
  fingerprintTargetPoint,
} from "@/lib/plots/fingerprint";

const HOURS = 24;
const DAYS = 10;
const values = Float32Array.from({ length: DAYS * HOURS }, (_, i) =>
  Math.sin(i / 5) + (i % HOURS) / 10,
);
const grid = fingerprintGrid(values, HOURS, null);

const layoutFor = (transposed: boolean): FingerprintLayout => ({
  grid,
  width: 640,
  height: 400,
  transposed,
  margins: { top: 56, left: 56 },
});

const targets: FingerprintTarget[] = [
  { kind: "cell", col: 0, hour: 0 },
  { kind: "cell", col: 3, hour: 17 },
  { kind: "cell", col: DAYS - 1, hour: HOURS - 1 },
  { kind: "column", col: 4 },
  { kind: "hour", hour: 9 },
];

describe("fingerprintTargetPoint", () => {
  for (const transposed of [false, true]) {
    it(`maps back to the same target${transposed ? " when transposed" : ""}`, () => {
      const layout = layoutFor(transposed);
      for (const target of targets) {
        const at = fingerprintTargetPoint(layout, target);
        expect(at).not.toBeNull();
        expect(fingerprintTargetAt(layout, at!.x, at!.y)).toEqual(target);
      }
    });
  }

  it("moves a pinned cell when the plot is transposed", () => {
    const target: FingerprintTarget = { kind: "cell", col: 3, hour: 17 };
    expect(fingerprintTargetPoint(layoutFor(true), target)).not.toEqual(
      fingerprintTargetPoint(layoutFor(false), target),
    );
  });

  it("has no point on a hidden strip", () => {
    const layout = { ...layoutFor(false), margins: { top: 0, left: 56 } };
    expect(fingerprintTargetPoint(layout, { kind: "column", col: 4 })).toBeNull();
  });
});

describe("fingerprintGrid for one value a day", () => {
  // Daily values for 2001 and 2002 on the default axis: year * 100 + month.
  const daily = Float32Array.from({ length: 730 }, (_, day) => {
    const date = new Date(Date.UTC(2001, 0, 1 + day));
    return (date.getUTCFullYear() - 2001) * 100 + date.getUTCMonth();
  });

  it("lays years out as rows and months as columns", () => {
    const season = fingerprintGrid(daily, 1, [2001, 2002], "month");
    expect(season.seasonal?.years).toEqual([2001, 2002]);
    expect(season.hoursPerDay).toBe(2);
    expect(season.bins).toHaveLength(12);
    const cell = (month: number, row: number) => season.mean[month * 2 + row];
    expect(cell(0, 0)).toBe(0);
    expect(cell(0, 1)).toBe(100);
    expect(cell(11, 1)).toBe(111);
  });

  it("keeps the day-of-cycle layout when asked to", () => {
    const flat = fingerprintGrid(daily, 1, [2001, 2002], "month", "hours");
    expect(flat.seasonal).toBeUndefined();
    expect(flat.bins).toHaveLength(24);
  });
});
