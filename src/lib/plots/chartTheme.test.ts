import { describe, expect, it } from "vitest";
import {
  formatSeriesValue,
  formatTickValue,
  valueDomain,
} from "@/lib/plots/chartTheme";

describe("formatSeriesValue", () => {
  it("keeps two decimals in the NEE range", () => {
    expect(formatSeriesValue(5.234)).toBe("5.23");
    expect(formatSeriesValue(-12.5)).toBe("-12.50");
  });

  it("keeps small values readable", () => {
    expect(formatSeriesValue(1.6e-5)).toBe("1.6e-5");
    expect(formatSeriesValue(0.0523)).toBe("0.0523");
  });

  it("drops decimals on large values", () => {
    expect(formatSeriesValue(1013.25)).toBe("1013");
    expect(formatSeriesValue(273.15)).toBe("273.1");
    expect(formatSeriesValue(101325)).toBe("101325");
    expect(formatSeriesValue(2.5e7)).toBe("2.5e+7");
  });

  it("prints zero plainly", () => {
    expect(formatSeriesValue(0)).toBe("0");
    expect(formatSeriesValue(-1e-13)).toBe("0");
  });
});

describe("formatTickValue", () => {
  it("drops trailing zeros", () => {
    expect(formatTickValue(2)).toBe("2");
    expect(formatTickValue(0.5)).toBe("0.5");
    expect(formatTickValue(1e-5)).toBe("1e-5");
  });
});

describe("valueDomain", () => {
  it("keeps zero for data that crosses it", () => {
    const [lo, hi] = valueDomain(-5, 10);
    expect(lo).toBeLessThan(-5);
    expect(hi).toBeGreaterThan(10);
  });

  it("starts at zero for data close to it", () => {
    expect(valueDomain(1e-7, 2e-5)[0]).toBe(0);
  });

  it("fits data far from zero", () => {
    const [lo, hi] = valueDomain(990, 1035);
    expect(lo).toBeGreaterThan(980);
    expect(lo).toBeLessThan(990);
    expect(hi).toBeGreaterThan(1035);
  });
});
