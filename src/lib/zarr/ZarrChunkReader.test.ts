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

  function stubArray() {
    return {
      shape: [4, 2, 40, 40],
      chunks: [2, 2, 40, 40],
      attrs: { units: "gC m-2 h-1" },
      getChunk: mockGetChunk,
    };
  }

  beforeEach(() => {
    mockGetChunk.mockReset();
    mockFetchPixelTimeSeries.mockReset();
    mockOpen.mockReset();
    mockOpen.mockImplementation(async () => stubArray() as never);
    mockGetChunk.mockImplementation(async (coords: number[]) => {
      const [timeChunkIdx] = coords;
      const shape = [2, 2, 40, 40] as const;
      const data = makeChunkData(shape);
      for (let i = 0; i < data.length; i++) {
        data[i] += timeChunkIdx * 10_000;
      }
      return { data, shape: [...shape] };
    });
  });

  it("fetches per time-chunk on cache miss, reports progress, and prefetches", async () => {
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
    const progress: Array<[number, number]> = [];
    // The stub spans two native time-chunks, so the pixel fetch runs twice
    // and the segments are stitched in order.
    const first = await reader.getTimeSeries(
      makeGrid(50, 50),
      undefined,
      undefined,
      (completed, total) => progress.push([completed, total]),
    );

    expect(mockFetchPixelTimeSeries).toHaveBeenCalledTimes(2);
    expect(Array.from(first.values)).toEqual([1, 2, 3, 4, 1, 2, 3, 4]);
    expect(progress[0]).toEqual([0, 2]);
    expect(progress.at(-1)).toEqual([2, 2]);

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
    await vi.waitFor(() => {
      expect(mockGetChunk).toHaveBeenCalledTimes(2);
    });

    mockFetchPixelTimeSeries.mockClear();
    mockGetChunk.mockClear();

    const second = await reader.getTimeSeries(makeGrid(51, 51));

    expect(mockFetchPixelTimeSeries).not.toHaveBeenCalled();
    expect(mockGetChunk).not.toHaveBeenCalled();
    expect(Array.from(second.values)).toEqual([
      121, 221, 1121, 1221, 10_121, 10_221, 11_121, 11_221,
    ]);
  });

  it("opens each variable only once under concurrent requests", async () => {
    mockFetchPixelTimeSeries.mockResolvedValue({
      values: new Float32Array([1, 2, 3, 4]),
      variable: "NEE",
      units: "gC m-2 h-1",
    });

    const reader = new ZarrChunkReader(ds);
    await Promise.all([
      reader.getTimeSeries(makeGrid(50, 50)),
      reader.getTimeSeries(makeGrid(80, 80)),
    ]);

    expect(mockOpen).toHaveBeenCalledTimes(1);
  });

  it("dedupes concurrent prefetch for the same spatial block", async () => {
    mockFetchPixelTimeSeries.mockResolvedValue({
      values: new Float32Array([1, 2, 3, 4]),
      variable: "NEE",
      units: "gC m-2 h-1",
    });

    const reader = new ZarrChunkReader(ds);
    await Promise.all([
      reader.getTimeSeries(makeGrid(50, 50)),
      reader.getTimeSeries(makeGrid(51, 51)),
    ]);

    expect(mockGetChunk).toHaveBeenCalledTimes(2);
  });
});
