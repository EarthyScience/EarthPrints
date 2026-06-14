import { beforeEach, describe, expect, it, vi } from "vitest";
import { ZarrChunkReader } from "@/lib/zarr/ZarrChunkReader";
import { fetchChunk, type ZarrStore } from "@/lib/zarr/store";
import type { GridCell } from "@/types/map";

vi.mock("zarrita", () => ({
  open: vi.fn().mockResolvedValue({
    chunks: [1461, 24, 40, 40],
  }),
}));

vi.mock("@/lib/zarr/store", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/zarr/store")>();
  return {
    ...original,
    fetchChunk: vi.fn(),
  };
});

const mockFetchChunk = vi.mocked(fetchChunk);

const ds = {
  store: {},
  root: { resolve: vi.fn((name: string) => name) },
} as unknown as ZarrStore;

function makeGrid(latIndex: number, lonIndex: number): GridCell {
  return {
    lon: 0,
    lat: 0,
    latIndex,
    lonIndex,
  };
}

function makeChunkData(shape: readonly [number, number, number, number]) {
  const [timeCount, hourCount, latCount, lonCount] = shape;
  const data = new Float32Array(timeCount * hourCount * latCount * lonCount);

  for (let t = 0; t < timeCount; t++) {
    for (let h = 0; h < hourCount; h++) {
      for (let lat = 0; lat < latCount; lat++) {
        for (let lon = 0; lon < lonCount; lon++) {
          const index =
            ((t * hourCount + h) * latCount + lat) * lonCount + lon;
          data[index] = t * 1000 + h * 100 + lat * 10 + lon;
        }
      }
    }
  }

  return data;
}

describe("ZarrChunkReader", () => {
  beforeEach(() => {
    mockFetchChunk.mockReset();
  });

  it("fetches once and reuses the cache for nearby pixels", async () => {
    const shape = [2, 2, 40, 40] as const;
    const data = makeChunkData(shape);

    mockFetchChunk.mockResolvedValue({
      data,
      shape,
      chunkKey: "NEE:1:1",
      localOffset: { localLat: 10, localLon: 10 },
      variable: "NEE",
      units: "gC m-2 h-1",
    });

    const reader = new ZarrChunkReader(ds);
    const first = await reader.getTimeSeries(makeGrid(50, 50));
    const second = await reader.getTimeSeries(makeGrid(51, 51));

    expect(mockFetchChunk).toHaveBeenCalledTimes(1);
    expect(first.units).toBe("gC m-2 h-1");
    expect(Array.from(first.values)).toEqual([110, 210, 1110, 1210]);
    expect(Array.from(second.values)).toEqual([121, 221, 1121, 1221]);
  });
});
