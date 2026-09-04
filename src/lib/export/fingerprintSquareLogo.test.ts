import { describe, expect, it } from "vitest";
import {
  SQUARE_LOGO_PRESETS,
  DEFAULT_SQUARE_LOGO_SIZE,
} from "./fingerprintSquareLogo";

describe("fingerprintSquareLogo presets", () => {
  it("defines standard and low resolution presets", () => {
    const ids = SQUARE_LOGO_PRESETS.map((p) => p.id);
    expect(ids).toContain("sm");
    expect(ids).toContain("md");
    expect(ids).toContain("lg");
    expect(ids).toContain("xl");
    expect(ids).toContain("2xl");

    const sizes = SQUARE_LOGO_PRESETS.map((p) => p.size);
    expect(sizes).toContain(512);
    expect(sizes).toContain(800);
    expect(sizes).toContain(1024);
    expect(sizes).toContain(1200);
    expect(sizes).toContain(2048);
  });

  it("sets a reasonable default size", () => {
    expect(DEFAULT_SQUARE_LOGO_SIZE).toBeGreaterThanOrEqual(512);
    expect(DEFAULT_SQUARE_LOGO_SIZE).toBeLessThanOrEqual(2048);
  });
});
