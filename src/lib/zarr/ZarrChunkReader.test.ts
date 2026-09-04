import { beforeEach, describe, expect, it, vi } from "vitest";
import * as zarr from "zarrita";
import { ZarrChunkReader } from "@/lib/zarr/ZarrChunkReader";
import {
  ChunkWorkerClient,
  type DecodedBlock,
} from "@/lib/zarr/chunkWorkerClient";
import type { ZarrStore } from "@/lib/zarr/store";

type DecodeRequest = Parameters<ChunkWorkerClient["decode"]>[0];
import type { GridCell } from "@/types/map";

vi.mock("zarrita", async (importOriginal) => {
  const original = await importOriginal<typeof import("zarrita")>();
  return {
    ...original,
    open: vi.fn(),
  };
});

vi.mock("@/lib/zarr/chunkWorkerClient", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("@/lib/zarr/chunkWorkerClient")>();
  return {
    ...original,
    ChunkWorkerClient: {
      ...original.ChunkWorkerClient,
      create: vi.fn(() => null),
    },
  };
});

const mockOpen = vi.mocked(zarr.open);
const mockCreateWorker = vi.mocked(ChunkWorkerClient.create);

const ds = {
  store: {},
  root: { resolve: vi.fn((name: string) => name) },
  url: "https://example.test/store",
} as unknown as ZarrStore;

function makeGrid(latIndex: number, lonIndex: number): GridCell {
  return { lon: 0, lat: 0, latIndex, lonIndex };
}

function makeChunkData(shape: readonly [number, number, number, number]) {
  const [timeCount, hourCount, latCount, lonCount] = shape;
  const data = new Float32Array(timeCount * hourCount * latCount * lonCount);

  for (let t = 0; t < timeCount; t++) {
    for (let h = 0; h < hourCount; h++) {
      for (let lat = 0; lat < latCount; lat++) {
        for (let lon = 0; lon < lonCount; lon++) {
          const index = ((t * hourCount + h) * latCount + lat) * lonCount + lon;
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
    mockOpen.mockReset();
    mockCreateWorker.mockReset();
    mockCreateWorker.mockReturnValue(null);
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

  it("decodes one chunk per time chunk and stitches the pixel series", async () => {
    const reader = new ZarrChunkReader(ds);
    const series = await reader.getTimeSeries(makeGrid(50, 50));

    expect(mockGetChunk).toHaveBeenCalledTimes(2);
    expect(series.units).toBe("gC m-2 h-1");
    expect(Array.from(series.values)).toEqual([
      110, 210, 1110, 1210, 10_110, 10_210, 11_110, 11_210,
    ]);
  });

  it("never holds more than one decoded chunk in flight", async () => {
    let concurrent = 0;
    let peak = 0;
    mockGetChunk.mockImplementation(async (coords: number[]) => {
      concurrent += 1;
      peak = Math.max(peak, concurrent);
      await new Promise((resolve) => setTimeout(resolve, 0));
      concurrent -= 1;
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

    expect(mockGetChunk).toHaveBeenCalledTimes(2);
    expect(peak).toBe(1);
  });

  it("serves a neighbouring pixel from the harvested block", async () => {
    const reader = new ZarrChunkReader(ds);
    await reader.getTimeSeries(makeGrid(50, 50));
    mockGetChunk.mockClear();

    // Local (11, 11) sits inside the 5x5 block around local (10, 10).
    const second = await reader.getTimeSeries(makeGrid(51, 51));

    expect(mockGetChunk).not.toHaveBeenCalled();
    expect(Array.from(second.values)).toEqual([
      121, 221, 1121, 1221, 10_121, 10_221, 11_121, 11_221,
    ]);
  });

  it("refetches for a pixel outside the harvested block", async () => {
    const reader = new ZarrChunkReader(ds);
    await reader.getTimeSeries(makeGrid(50, 50));
    mockGetChunk.mockClear();

    // Local (15, 15) is outside the block, which spans local 8..12.
    await reader.getTimeSeries(makeGrid(55, 55));

    expect(mockGetChunk).toHaveBeenCalledTimes(2);
  });

  it("opens each variable only once under concurrent requests", async () => {
    const reader = new ZarrChunkReader(ds);
    await Promise.all([
      reader.getTimeSeries(makeGrid(50, 50)),
      reader.getTimeSeries(makeGrid(80, 80)),
    ]);

    expect(mockOpen).toHaveBeenCalledTimes(1);
  });

  it("shares one decode between concurrent requests for the same pixel", async () => {
    const reader = new ZarrChunkReader(ds);
    const [first, second] = await Promise.all([
      reader.getTimeSeries(makeGrid(50, 50)),
      reader.getTimeSeries(makeGrid(50, 50)),
    ]);

    // One decode per time chunk, shared by both callers.
    expect(mockGetChunk).toHaveBeenCalledTimes(2);
    expect(Array.from(first.values)).toEqual(Array.from(second.values));
  });

  it("gives each concurrent pixel its own series", async () => {
    const reader = new ZarrChunkReader(ds);
    const [first, second] = await Promise.all([
      reader.getTimeSeries(makeGrid(50, 50)),
      reader.getTimeSeries(makeGrid(51, 51)),
    ]);

    // Neighbours share a chunk but not a neighbourhood, so a concurrent
    // request must decode for itself rather than wait on the other and come
    // back empty.
    expect(Array.from(first.values)).toEqual([
      110, 210, 1110, 1210, 10_110, 10_210, 11_110, 11_210,
    ]);
    expect(Array.from(second.values)).toEqual([
      121, 221, 1121, 1221, 10_121, 10_221, 11_121, 11_221,
    ]);
  });

  it("evicts least-recently-used pixel entries", async () => {
    // One entry per pixel per time chunk, so this holds a single pixel.
    const reader = new ZarrChunkReader(ds, 1);
    await reader.getTimeSeries(makeGrid(50, 50));
    mockGetChunk.mockClear();

    await reader.getTimeSeries(makeGrid(50, 50));

    expect(mockGetChunk).toHaveBeenCalledTimes(2);
  });

  it("reports progress that spans every downloaded chunk", async () => {
    const reader = new ZarrChunkReader(ds);
    const updates: Array<{ loaded: number; total: number }> = [];

    await reader.getTimeSeries(makeGrid(50, 50), undefined, undefined, (
      loaded,
      total,
    ) => {
      updates.push({ loaded, total });
    });

    expect(updates.length).toBeGreaterThan(0);
    const last = updates.at(-1)!;
    expect(last.loaded).toBeLessThanOrEqual(last.total);
  });

  it("reports immediate completion when every chunk is cached", async () => {
    const reader = new ZarrChunkReader(ds);
    await reader.getTimeSeries(makeGrid(50, 50));

    const updates: Array<{ loaded: number; total: number }> = [];
    await reader.getTimeSeries(makeGrid(50, 50), undefined, undefined, (
      loaded,
      total,
    ) => {
      updates.push({ loaded, total });
    });

    expect(updates).toEqual([{ loaded: 1, total: 1 }]);
  });

  it("decodes through the worker when one is available", async () => {
    const decode = vi.fn<
      (request: DecodeRequest) => Promise<DecodedBlock>
    >(async () => ({
      block: {
        localLatStart: 10,
        localLatCount: 1,
        localLonStart: 10,
        localLonCount: 1,
      },
      seriesLength: 4,
      values: new Float32Array([1, 2, 3, 4]),
    }));
    mockCreateWorker.mockReturnValue({
      decode,
      terminate: vi.fn(),
    } as unknown as ChunkWorkerClient);

    const reader = new ZarrChunkReader(ds);
    const series = await reader.getTimeSeries(makeGrid(50, 50));

    expect(mockGetChunk).not.toHaveBeenCalled();
    expect(decode).toHaveBeenCalledTimes(2);
    expect(decode.mock.calls[0]![0]).toMatchObject({
      storeUrl: "https://example.test/store",
      variable: "NEE",
      chunkCoords: [0, 0, 1, 1],
      localLat: 10,
      localLon: 10,
    });
    expect(Array.from(series.values)).toEqual([1, 2, 3, 4, 1, 2, 3, 4]);
  });

  it("falls back to inline decoding when the worker fails", async () => {
    const decode = vi.fn<
      (request: DecodeRequest) => Promise<DecodedBlock>
    >(async () => {
      throw new Error("worker died");
    });
    const terminate = vi.fn();
    mockCreateWorker.mockReturnValue({
      decode,
      terminate,
    } as unknown as ChunkWorkerClient);

    const reader = new ZarrChunkReader(ds);
    const series = await reader.getTimeSeries(makeGrid(50, 50));

    // Retired after the first failure, so only the first chunk tries it.
    expect(decode).toHaveBeenCalledTimes(1);
    expect(terminate).toHaveBeenCalledTimes(1);
    expect(mockGetChunk).toHaveBeenCalledTimes(2);
    expect(Array.from(series.values)).toEqual([
      110, 210, 1110, 1210, 10_110, 10_210, 11_110, 11_210,
    ]);
  });
});
