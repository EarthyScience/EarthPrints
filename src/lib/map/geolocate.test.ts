import { describe, expect, it } from "vitest";
import {
  describeAccuracy,
  describeGeolocationError,
  isGeolocationAvailable,
  shouldWarmCache,
} from "@/lib/map/geolocate";

describe("describeGeolocationError", () => {
  it("explains a blocked permission", () => {
    expect(describeGeolocationError({ code: 1 })).toMatch(/blocked/);
  });

  it("explains a timeout", () => {
    expect(describeGeolocationError({ code: 3 })).toMatch(/too long/);
  });

  it("falls back to unavailable for a missing fix or an unknown error", () => {
    const unavailable = "Your location is not available right now.";
    expect(describeGeolocationError({ code: 2 })).toBe(unavailable);
    expect(describeGeolocationError(new Error("boom"))).toBe(unavailable);
    expect(describeGeolocationError(undefined)).toBe(unavailable);
  });
});

describe("shouldWarmCache", () => {
  it("warms when the browser reports nothing about the connection", () => {
    expect(shouldWarmCache(undefined)).toBe(true);
    expect(shouldWarmCache({})).toBe(true);
  });

  it("warms on a fast connection", () => {
    expect(shouldWarmCache({ effectiveType: "4g" })).toBe(true);
  });

  it("holds off when the visitor asked to save data", () => {
    expect(shouldWarmCache({ saveData: true, effectiveType: "4g" })).toBe(false);
  });

  it("holds off on slow connections", () => {
    for (const effectiveType of ["slow-2g", "2g", "3g"]) {
      expect(shouldWarmCache({ effectiveType })).toBe(false);
    }
  });
});

describe("describeAccuracy", () => {
  it("rounds sub-kilometre fixes to tens of metres", () => {
    expect(describeAccuracy(43)).toBe("Your location, accurate to about 40 m");
    expect(describeAccuracy(2)).toBe("Your location, accurate to about 10 m");
  });

  it("reports coarse fixes in kilometres", () => {
    expect(describeAccuracy(3400)).toBe("Your location, accurate to about 3 km");
  });

  it("omits the accuracy when the browser gave none", () => {
    expect(describeAccuracy(0)).toBe("Your location");
    expect(describeAccuracy(Number.NaN)).toBe("Your location");
  });
});

describe("isGeolocationAvailable", () => {
  it("is false outside a browser", () => {
    expect(isGeolocationAvailable()).toBe(false);
  });
});
