import { beforeEach, describe, expect, it, vi } from "vitest";
import * as zarr from "zarrita";
import { deriveGridSpec } from "@/lib/zarr/gridSpec";
import { DEFAULT_GRID_SPEC } from "@/lib/constants/store";
import type { ZarrStore } from "@/lib/zarr/store";

vi.mock("zarrita", async (importOriginal) => {
  const original = await importOriginal<typeof import("zarrita")>();
  return {
    ...original,
    open: vi.fn(),
    get: vi.fn(),
  };
});

const mockOpen = vi.mocked(zarr.open);
const mockGet = vi.mocked(zarr.get);

const ds = {
  store: {},
  root: { resolve: vi.fn((name: string) => name) },
} as unknown as ZarrStore;

// First two cell centers per coordinate axis, keyed by resolved array path.
const AXIS_HEADS: Record<string, number[]> = {
  lon: [-179.975, -179.925],
  lat: [89.975, 89.925],
};

describe("deriveGridSpec", () => {
  beforeEach(() => {
    mockOpen.mockReset();
    mockGet.mockReset();

    mockOpen.mockImplementation(async (loc: unknown) => {
      const path = String(loc);
      if (path === "NEE") {
        return {
          shape: [7670, 24, 3600, 7200],
          chunks: [1461, 24, 40, 40],
          attrs: { _ARRAY_DIMENSIONS: ["time", "hour", "lat", "lon"] },
        } as never;
      }
      return { shape: [path === "lon" ? 7200 : 3600] } as never;
    });

    mockGet.mockImplementation(async (array: unknown) => {
      // The array handle is whatever `open` returned; recover its axis by shape.
      const shape = (array as { shape: number[] }).shape;
      const head = shape[0] === 7200 ? AXIS_HEADS.lon : AXIS_HEADS.lat;
      return { data: head } as never;
    });
  });

  it("reads extent, resolution, dimensions and native chunks from the store", async () => {
    const spec = await deriveGridSpec(ds, "NEE");

    expect(spec.grid).toEqual({
      lonStart: -179.975,
      lonStep: expect.closeTo(0.05, 10),
      latStart: 89.975,
      latStep: expect.closeTo(-0.05, 10),
    });
    expect(spec.dimensions).toEqual({
      time: 7670,
      hour: 24,
      lat: 3600,
      lon: 7200,
    });
    expect(spec.nativeChunks).toEqual({ lat: 40, lon: 40 });
    expect(spec.spatialResolutionDeg).toBeCloseTo(0.05, 10);
  });

  it("falls back to the default spec when the variable cannot be opened", async () => {
    mockOpen.mockRejectedValue(new Error("network"));

    const spec = await deriveGridSpec(ds, "NEE");

    expect(spec).toBe(DEFAULT_GRID_SPEC);
  });
});
