import { describe, expect, it } from "vitest";
import {
  clampSidebarWidth,
  maxSidebarWidth,
  parseSidebarState,
  MAP_MIN_WIDTH,
  SIDEBAR_DEFAULT_WIDTH,
  SIDEBAR_MAX_WIDTH,
  SIDEBAR_MIN_WIDTH,
} from "@/lib/sidebar";

const WIDE = 1920;

describe("clampSidebarWidth", () => {
  it("keeps a width that is already in range", () => {
    expect(clampSidebarWidth(480, WIDE)).toBe(480);
  });

  it("holds the floor and the ceiling", () => {
    expect(clampSidebarWidth(120, WIDE)).toBe(SIDEBAR_MIN_WIDTH);
    expect(clampSidebarWidth(5000, WIDE)).toBe(SIDEBAR_MAX_WIDTH);
  });

  it("leaves the map its minimum on a narrow window", () => {
    const viewport = 1000;
    expect(clampSidebarWidth(SIDEBAR_MAX_WIDTH, viewport)).toBe(
      viewport - MAP_MIN_WIDTH,
    );
  });

  it("keeps the panel usable when the window cannot fit both minimums", () => {
    expect(clampSidebarWidth(SIDEBAR_MAX_WIDTH, 560)).toBe(SIDEBAR_MIN_WIDTH);
    expect(maxSidebarWidth(560)).toBe(SIDEBAR_MIN_WIDTH);
  });

  it("falls back to the default for a width that is not a number", () => {
    expect(clampSidebarWidth(Number.NaN, WIDE)).toBe(SIDEBAR_DEFAULT_WIDTH);
  });

  it("rounds to whole pixels", () => {
    expect(clampSidebarWidth(412.6, WIDE)).toBe(413);
  });
});

describe("parseSidebarState", () => {
  it("round-trips a stored state", () => {
    expect(parseSidebarState(JSON.stringify({ width: 512, collapsed: true })))
      .toEqual({ width: 512, collapsed: true });
  });

  it("bounds a stored width that is out of range", () => {
    expect(
      parseSidebarState(JSON.stringify({ width: 9000, collapsed: false })),
    ).toEqual({ width: SIDEBAR_MAX_WIDTH, collapsed: false });
  });

  it("rejects anything it cannot trust", () => {
    expect(parseSidebarState(null)).toBeNull();
    expect(parseSidebarState("")).toBeNull();
    expect(parseSidebarState("{ not json")).toBeNull();
    expect(parseSidebarState("42")).toBeNull();
    expect(parseSidebarState(JSON.stringify({ collapsed: true }))).toBeNull();
    expect(
      parseSidebarState(JSON.stringify({ width: "400", collapsed: false })),
    ).toBeNull();
    expect(parseSidebarState(JSON.stringify({ width: 400 }))).toBeNull();
  });
});
