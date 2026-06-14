import { beforeEach, describe, expect, it, vi } from "vitest";
import * as zarr from "zarrita";
import { ZarrChunkReader } from "@/lib/zarr/ZarrChunkReader";
import { fetchPixelTimeSeries, type ZarrStore } from "@/lib/zarr/store";
import type { GridCell } from "@/types/map";

vi.mock("zarrita", async (importOriginal) => {
  const original = await importOriginal<typeof import("zarrita")>();
  return {
    ...original,
    open: vi.fn(),
  };
});

vi.mock("@/lib/zarr/store", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/zarr/store")>();
  return {
    ...original,
    fetchPixelTimeSeries: vi.fn(),
  };
});

const mockOpen = vi.mocked(zarr.open);
const mockFetchPixelTimeSeries = vi.mocked(fetchPixelTimeSeries);

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
  const mockGetChunk = vi.fn();

  beforeEach(() => {
    mockGetChunk.mockReset();
    mockFetchPixelTimeSeries.mockReset();
    mockOpen.mockResolvedValue({
      shape: [4, 2, 40, 40],
      chunks: [2, 2, 40, 40],
      attrs: { units: "gC m-2 h-1" },
      getChunk: mockGetChunk,
    } as never);
  });

  it("uses the fast pixel fetch on cache miss and prefetches native chunks", async () => {
    mockFetchPixelTimeSeries.mockResolvedValue({
      values: new Float32Array([1, 2, 3, 4]),
      variable: "NEE",
      units: "gC m-2 h-1",
    });
    mockGetChunk.mockImplementation(async (coords: number[]) => {
      const [timeChunkIdx] = coords;
      const shape = [2, 2, 40, 40] as const;
      const data = makeChunkData(shape);
      for (let i = 0; i < data.length; i++) {
        data[i] += timeChunkIdx * 10_000;
      }
      return { data, shape: [...shape] };
    });

    const reader = new ZarrChunkReader(ds);
    const first = await reader.getTimeSeries(makeGrid(50, 50));

    expect(mockFetchPixelTimeSeries).toHaveBeenCalledTimes(1);
    expect(Array.from(first.values)).toEqual([1, 2, 3, 4]);

    await vi.waitFor(() => {
      expect(mockGetChunk).toHaveBeenCalledTimes(2);
    });
  });

  it("serves nearby pixels from native cache after prefetch", async () => {
    mockFetchPixelTimeSeries.mockResolvedValue({
      values: new Float32Array([1, 2, 3, 4]),
      variable: "NEE",
      units: "gC m-2 h-1",
    });
    mockGetChunk.mockImplementation(async (coords: number[]) => {
      const [timeChunkIdx] = coords;
      const shape = [2, 2, 40, 40] as const;
      const data = makeChunkData(shape);
      for (let i = 0; i < data.length; i++) {
        data[i] += timeChunkIdx * 10_000;
      }
      return { data, shape: [...shape] };
    });

    const reader = new ZarrChunkReader(ds);
    await reader.getTimeSeries(makeGrid(50, 50));
    await new Promise((resolve) => setTimeout(resolve, 0));

    mockFetchPixelTimeSeries.mockClear();
    mockGetChunk.mockClear();

    const second = await reader.getTimeSeries(makeGrid(51, 51));

    expect(mockFetchPixelTimeSeries).not.toHaveBeenCalled();
    expect(mockGetChunk).not.toHaveBeenCalled();
    expect(Array.from(second.values)).toEqual([
      121, 221, 1121, 1221, 10_121, 10_221, 11_121, 11_221,
    ]);
  });
});
