import { describe, expect, it } from "vitest";
import { DIVERGING_TABLES, sampleTable } from "@/lib/map/colormapTables";
import {
  asymmetricExtents,
  COLORMAPS,
  type ColormapId,
  dayIndexTicks,
  defaultColormapId,
  fingerprintColorScale,
  fingerprintRampSamples,
  formatIsoDate,
  symmetricAbsMax,
  yearRangesInWindow,
  zeroFrac,
} from "@/lib/map/fingerprintScale";

describe("symmetricAbsMax", () => {
  it("returns the largest absolute finite value", () => {
    expect(symmetricAbsMax([-3, 1, 2])).toBe(3);
    expect(symmetricAbsMax([0.5, -0.2, 4.1])).toBeCloseTo(4.1, 10);
  });

  it("ignores NaN and non-finite entries", () => {
    expect(symmetricAbsMax([NaN, -2, Infinity, 1])).toBe(2);
  });

  it("returns 0 for an all-missing series", () => {
    expect(symmetricAbsMax([NaN, NaN])).toBe(0);
    expect(symmetricAbsMax([])).toBe(0);
  });
});

describe("asymmetricExtents", () => {
  it("separates negative and positive extents", () => {
    const { negMax, posMax } = asymmetricExtents([-1, 0, 3]);
    expect(negMax).toBeCloseTo(1);
    expect(posMax).toBeCloseTo(3);
  });

  it("returns a sentinel for the missing side", () => {
    // All-positive: negMax should be the tiny sentinel, not 0
    const { negMax } = asymmetricExtents([1, 2, 3]);
    expect(negMax).toBeGreaterThan(0);
    expect(negMax).toBeLessThan(1e-5);
  });

  it("ignores non-finite values", () => {
    const { negMax, posMax } = asymmetricExtents([NaN, -2, Infinity, 1]);
    expect(negMax).toBeCloseTo(2);
    expect(posMax).toBeCloseTo(1);
  });
});

describe("fingerprintColorScale — every palette is centred on zero", () => {
  const ids = Object.keys(COLORMAPS) as ColormapId[];

  it("maps non-finite values to transparent", () => {
    for (const id of ids) {
      const scale = fingerprintColorScale(id);
      expect(scale(NaN, 5, 5)).toBe("transparent");
      expect(scale(Infinity, 5, 5)).toBe("transparent");
    }
  });

  it("gives the two extremes distinct colours", () => {
    for (const id of ids) {
      const scale = fingerprintColorScale(id);
      expect(scale(-5, 5, 5)).not.toBe(scale(5, 5, 5));
      expect(scale(-5, 5, 5)).toMatch(/^rgb\(/);
    }
  });

  it("clamps values beyond either extent to the poles", () => {
    for (const id of ids) {
      const scale = fingerprintColorScale(id);
      expect(scale(-99, 2, 2)).toBe(scale(-2, 2, 2));
      expect(scale(99, 2, 2)).toBe(scale(2, 2, 2));
    }
  });

  it("holds zero at the same colour however lopsided the extents are", () => {
    for (const id of ids) {
      if (id === "flux") continue; // see the seam test below
      const scale = fingerprintColorScale(id);
      const atZero = scale(0, 30, 8);
      expect(scale(0, 1, 1000)).toBe(atZero);
      expect(scale(0, 5, 5)).toBe(atZero);
    }
  });

  it("scales each half against its own extent, not the larger one", () => {
    for (const id of ids) {
      const scale = fingerprintColorScale(id);
      // The most-negative value hits the cool pole whether or not the positive
      // side reaches as far. Before this, the short side was never reached.
      expect(scale(-1, 1, 3)).toBe(scale(-5, 5, 5));
      expect(scale(3, 1, 3)).toBe(scale(5, 5, 5));
      // Equal magnitudes of opposite sign are deliberately not equally intense.
      expect(scale(-1, 1, 3)).not.toBe(scale(1, 1, 3));
    }
  });

  it("leaves an unused half neutral rather than dividing by zero", () => {
    for (const id of ids) {
      if (id === "flux") continue; // see the seam test below
      const scale = fingerprintColorScale(id);
      expect(scale(3, 0, 0)).toBe(scale(-3, 0, 0));
    }
  });
});

describe("fingerprintColorScale — table palettes", () => {
  it("walks the real lookup table, centre stop at zero", () => {
    const scale = fingerprintColorScale("vik");
    const table = DIVERGING_TABLES.vik;
    const at = (u: number) => {
      const [r, g, b] = sampleTable(table, u);
      return `rgb(${r}, ${g}, ${b})`;
    };
    expect(scale(0, 30, 8)).toBe(at(0.5));
    expect(scale(-30, 30, 8)).toBe(at(0));
    expect(scale(8, 30, 8)).toBe(at(1));
    // Half of each arm sits a quarter in from its own end.
    expect(scale(-15, 30, 8)).toBe(at(0.25));
    expect(scale(4, 30, 8)).toBe(at(0.75));
  });

  it("gives light and dark defaults different neutrals", () => {
    const luma = (css: string) => {
      const [r, g, b] = css.match(/\d+/g)!.map(Number);
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const light = fingerprintColorScale(defaultColormapId(true))(0, 5, 5);
    const dark = fingerprintColorScale(defaultColormapId(false))(0, 5, 5);
    expect(luma(light)).toBeGreaterThan(180);
    expect(luma(dark)).toBeLessThan(60);
  });
});

describe("fingerprintColorScale — flux", () => {
  const scale = fingerprintColorScale("flux");

  it("maps non-finite values to transparent", () => {
    expect(scale(NaN, 1, 3)).toBe("transparent");
  });

  it("returns an rgb string for valid values", () => {
    expect(scale(-1, 1, 3)).toMatch(/^rgb\(/);
    expect(scale(3, 1, 3)).toMatch(/^rgb\(/);
    expect(scale(0, 1, 3)).toMatch(/^rgb\(/);
  });

  /*
   * Flux is two sequential CET ramps glued at zero rather than one diverging
   * table, and the two ends do not meet: approaching zero from below lands on
   * kbc\'s pale cyan, from above on kryw\'s white. So the neutral colour depends
   * on the sign of the value, and a cell at exactly 0 takes the white side.
   * Pinned here so the seam is visible rather than surprising; the single-table
   * palettes are continuous through zero by construction.
   */
  it("has a documented discontinuity at zero", () => {
    const fromBelow = scale(-1e-12, 1, 3);
    const atZero = scale(0, 1, 3);
    expect(fromBelow).toBe("rgb(179, 255, 246)");
    expect(atZero).toBe("rgb(255, 255, 255)");
    expect(fromBelow).not.toBe(atZero);
  });
});

describe("colorbar geometry", () => {
  it("places zero by the ratio of the two extents", () => {
    expect(zeroFrac(30, 10)).toBeCloseTo(0.75, 10);
    expect(zeroFrac(5, 5)).toBeCloseTo(0.5, 10);
    expect(zeroFrac(0, 0)).toBe(0.5);
  });

  it("samples a bar running from -negMax to +posMax, neutral at the pivot", () => {
    const samples = fingerprintRampSamples("vik", 30, 10, 5);
    const scale = fingerprintColorScale("vik");
    expect(samples[0].value).toBeCloseTo(-30, 10);
    expect(samples[0].color).toBe(scale(-30, 30, 10));
    expect(samples[4].value).toBeCloseTo(10, 10);
    expect(samples[4].color).toBe(scale(10, 30, 10));
    // zeroFrac is 0.75, which is sample 3 of 0..4.
    expect(samples[3].value).toBeCloseTo(0, 10);
    expect(samples[3].color).toBe(scale(0, 30, 10));
  });

  it("covers every palette without gaps", () => {
    for (const id of Object.keys(COLORMAPS) as ColormapId[]) {
      const samples = fingerprintRampSamples(id, 2, 7);
      expect(samples).toHaveLength(32);
      expect(samples[0].frac).toBe(0);
      expect(samples[31].frac).toBe(1);
      for (const sample of samples) expect(sample.color).toMatch(/^rgb\(/);
    }
  });
});

describe("dayIndexTicks", () => {
  it("spans both ends and dedupes", () => {
    const ticks = dayIndexTicks(365);
    expect(ticks[0]).toBe(0);
    expect(ticks[ticks.length - 1]).toBe(364);
  });

  it("handles degenerate windows", () => {
    expect(dayIndexTicks(1)).toEqual([0]);
    expect(dayIndexTicks(0)).toEqual([0]);
  });
});

describe("time mapping", () => {
  it("maps day 0 to the 2001-01-01 origin", () => {
    expect(formatIsoDate(0)).toBe("2001-01-01");
    expect(formatIsoDate(364)).toBe("2001-12-31");
  });

  it("splits a window into contiguous calendar years", () => {
    // A 400-day window starting mid-2001 spans 2001 and 2002.
    const ranges = yearRangesInWindow(180, 400);
    expect(ranges.map((r) => r.year)).toEqual([2001, 2002]);
    expect(ranges[0].startDay).toBe(0);
    expect(ranges[1].endDay).toBe(399);
    // Ranges are contiguous and non-overlapping.
    expect(ranges[1].startDay).toBe(ranges[0].endDay + 1);
  });
});
