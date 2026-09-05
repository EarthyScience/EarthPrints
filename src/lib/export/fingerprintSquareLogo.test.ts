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

  it("executes buildSquareFingerprintCanvas successfully for non-contiguous years", async () => {
    const { buildSquareFingerprintCanvas } = await import(
      "./fingerprintSquareLogo"
    );
    const { buildProvenance } = await import("./provenance");

    const mockCtx = {
      fillRect: () => {},
      createLinearGradient: () => ({ addColorStop: () => {} }),
      beginPath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      stroke: () => {},
      fill: () => {},
      fillText: () => {},
      measureText: () => ({ width: 100 }),
      save: () => {},
      restore: () => {},
      roundRect: () => {},
    };

    const mockCanvas = {
      width: 0,
      height: 0,
      getContext: () => mockCtx,
    } as unknown as HTMLCanvasElement;

    globalThis.document = {
      createElement: () => mockCanvas,
    } as unknown as Document;

    const prov = buildProvenance({
      selection: {
        click: { lon: 11.5, lat: 50.9 },
        grid: { lon: 11.5, lat: 50.9, lonIndex: 100, latIndex: 100 },
      },
      selectedYears: [2002, 2018],
      valueCount: (365 + 365) * 24,
      units: "gC m-2 d-1",
    });

    const values = new Float32Array((365 + 365) * 24).fill(0.2);

    const canvas = buildSquareFingerprintCanvas({
      values,
      prov,
      selectedYears: [2002, 2018],
      size: 512,
    });

    expect(canvas).toBeDefined();
    expect(canvas.width).toBe(512);
  });
});
