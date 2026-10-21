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
