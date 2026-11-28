import { describe, expect, it } from "vitest";
import { decodeCfTimes, parseCfUnits } from "@/lib/zarr/cfTime";

const iso = (ms: number) => new Date(ms).toISOString();

describe("parseCfUnits", () => {
  it("reads the common spellings", () => {
    expect(parseCfUnits("days since 2001-01-01 00:00:00")).not.toBeNull();
    expect(parseCfUnits("hours since 1900-1-1")).not.toBeNull();
    expect(parseCfUnits("seconds since 1970-01-01T00:00:00Z")).not.toBeNull();
    expect(parseCfUnits("microseconds since 1970-01-01")).not.toBeNull();
    expect(parseCfUnits("fortnights since 2000-01-01")).toBeNull();
    expect(parseCfUnits(undefined)).toBeNull();
  });
});

describe("decodeCfTimes", () => {
  it("decodes the standard calendar", () => {
    const out = decodeCfTimes([0, 365], "days since 2001-01-01 00:00:00", "proleptic_gregorian")!;
    expect(iso(out[0]!)).toBe("2001-01-01T00:00:00.000Z");
    expect(iso(out[1]!)).toBe("2002-01-01T00:00:00.000Z");
  });

  it("decodes bigint microseconds", () => {
    const out = decodeCfTimes([BigInt(21_600_000_000)], "microseconds since 1970-01-01", "standard")!;
    expect(iso(out[0]!)).toBe("1970-01-01T06:00:00.000Z");
  });

  it("skips February 29th in a noleap calendar", () => {
    const out = decodeCfTimes([58, 59], "days since 2000-01-01", "noleap")!;
    expect(iso(out[0]!)).toBe("2000-02-28T00:00:00.000Z");
    expect(iso(out[1]!)).toBe("2000-03-01T00:00:00.000Z");
  });

  it("stretches a 360_day year over the real one without collisions", () => {
    const raw = Array.from({ length: 361 }, (_, i) => i);
    const out = decodeCfTimes(raw, "days since 2000-01-01", "360_day")!;
    const days = Array.from(out.subarray(0, 360), (ms) => iso(ms).slice(0, 10));
    expect(new Set(days).size).toBe(360);
    expect(days[0]).toBe("2000-01-01");
    // Model February 30th (day 59) stays in February.
    expect(days[59]!.slice(0, 7)).toBe("2000-02");
    expect(days[359]).toBe("2000-12-30");
    expect(iso(out[360]!).slice(0, 10)).toBe("2001-01-01");
  });

  it("labels julian dates in the julian calendar", () => {
    // Julian 1970-01-01 plus a day is julian 1970-01-02.
    const out = decodeCfTimes([1], "days since 1970-01-01", "julian")!;
    expect(iso(out[0]!).slice(0, 10)).toBe("1970-01-02");
  });

  it("decodes month counts", () => {
    const out = decodeCfTimes([0, 1, 13], "months since 1850-01-15", "360_day")!;
    expect(iso(out[1]!).slice(0, 10)).toBe("1850-02-15");
    expect(iso(out[2]!).slice(0, 10)).toBe("1851-02-15");
  });

  it("keeps years before 100", () => {
    const out = decodeCfTimes([0], "days since 0001-01-01", "noleap")!;
    expect(new Date(out[0]!).getUTCFullYear()).toBe(1);
  });

  it("rejects unknown calendars", () => {
    expect(decodeCfTimes([0], "days since 2000-01-01", "martian")).toBeNull();
  });
});
