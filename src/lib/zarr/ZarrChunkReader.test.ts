import { beforeEach, describe, expect, it, vi } from "vitest";
import * as zarr from "zarrita";
import { ZarrChunkReader } from "@/lib/zarr/ZarrChunkReader";
import {
  ChunkWorkerClient,
  type DecodedChunk,
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

/** What the worker now posts back: one whole decoded native chunk. */
function makeDecodedChunk(timeChunkIdx = 0): DecodedChunk {
  const shape = [2, 2, 40, 40] as const;
  const data = makeChunkData(shape);
  for (let i = 0; i < data.length; i++) data[i] += timeChunkIdx * 10_000;
  return { data, shape: [...shape] };
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

  it("serves any cell of a cached patch without downloading again", async () => {
    const reader = new ZarrChunkReader(ds);
    await reader.getTimeSeries(makeGrid(50, 50));
    mockGetChunk.mockClear();

    // Local (15,15) and (39,39) of the same 40x40 patch. Under the old 5x5
    // harvest both were refetches; the whole patch is held now.
    await reader.getTimeSeries(makeGrid(55, 55));
    await reader.getTimeSeries(makeGrid(79, 79));

    expect(mockGetChunk).not.toHaveBeenCalled();
  });

  it("downloads again for a cell in a different patch", async () => {
    const reader = new ZarrChunkReader(ds);
    await reader.getTimeSeries(makeGrid(50, 50));
    mockGetChunk.mockClear();

    // Patch (2,2) rather than (1,1), so it was never decoded.
    await reader.getTimeSeries(makeGrid(80, 80));

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

    // Both cells live in one patch, so they share a single download and each
    // still reads its own pixel out of it.
    expect(mockGetChunk).toHaveBeenCalledTimes(2);
    expect(Array.from(first.values)).toEqual([
      110, 210, 1110, 1210, 10_110, 10_210, 11_110, 11_210,
    ]);
    expect(Array.from(second.values)).toEqual([
      121, 221, 1121, 1221, 10_121, 10_221, 11_121, 11_221,
    ]);
  });

  it("evicts least-recently-used patches once the byte budget is spent", async () => {
    // A one-byte budget keeps only the most recent patch.
    const reader = new ZarrChunkReader(ds, 1);
    await reader.getTimeSeries(makeGrid(50, 50));
    mockGetChunk.mockClear();

    await reader.getTimeSeries(makeGrid(50, 50));

    expect(mockGetChunk).toHaveBeenCalledTimes(2);
  });

  it("keeps both patches when the budget has room", async () => {
    const reader = new ZarrChunkReader(ds, 10 * 1024 * 1024);
    await reader.getTimeSeries(makeGrid(50, 50));
    mockGetChunk.mockClear();

    await reader.getTimeSeries(makeGrid(50, 50));

    expect(mockGetChunk).not.toHaveBeenCalled();
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
      (request: DecodeRequest) => Promise<DecodedChunk>
    >(async (request) => makeDecodedChunk(request.chunkCoords[0]!));
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
    });
    // Cell (50,50) is local (10,10) of the patch: lat*10 + lon = 110.
    expect(Array.from(series.values)).toEqual([
      110, 210, 1110, 1210, 10_110, 10_210, 11_110, 11_210,
    ]);
  });

  it("stops between chunks once the caller aborts", async () => {
    const controller = new AbortController();
    let calls = 0;
    mockGetChunk.mockImplementation(async (coords: number[]) => {
      calls += 1;
      // Abandon the request while its first chunk is being decoded.
      if (calls === 1) controller.abort();
      const [timeChunkIdx] = coords;
      const shape = [2, 2, 40, 40] as const;
      const data = makeChunkData(shape);
      for (let i = 0; i < data.length; i++) {
        data[i] += timeChunkIdx * 10_000;
      }
      return { data, shape: [...shape] };
    });

    const reader = new ZarrChunkReader(ds);
    await expect(
      reader.getTimeSeries(makeGrid(50, 50), undefined, undefined, undefined, controller.signal),
    ).rejects.toMatchObject({ name: "AbortError" });

    // The second chunk was never started.
    expect(mockGetChunk).toHaveBeenCalledTimes(1);
  });

  it("rejects immediately when handed an already-aborted signal", async () => {
    const controller = new AbortController();
    controller.abort();

    const reader = new ZarrChunkReader(ds);
    await expect(
      reader.getTimeSeries(makeGrid(50, 50), undefined, undefined, undefined, controller.signal),
    ).rejects.toMatchObject({ name: "AbortError" });

    expect(mockGetChunk).not.toHaveBeenCalled();
  });

  it("keeps a shared decode alive for the callers still waiting", async () => {
    const controller = new AbortController();
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });

    mockGetChunk.mockImplementation(async (coords: number[]) => {
      await gate;
      const [timeChunkIdx] = coords;
      const shape = [2, 2, 40, 40] as const;
      const data = makeChunkData(shape);
      for (let i = 0; i < data.length; i++) {
        data[i] += timeChunkIdx * 10_000;
      }
      return { data, shape: [...shape] };
    });

    const reader = new ZarrChunkReader(ds);
    const abandoned = reader.getTimeSeries(
      makeGrid(50, 50), undefined, undefined, undefined, controller.signal,
    );
    const kept = reader.getTimeSeries(makeGrid(50, 50));

    // One caller walks away; the other must still get its data.
    controller.abort();
    await expect(abandoned).rejects.toMatchObject({ name: "AbortError" });
    release!();

    const series = await kept;
    expect(Array.from(series.values)).toEqual([
      110, 210, 1110, 1210, 10_110, 10_210, 11_110, 11_210,
    ]);
  });

  it("hands the worker a signal so the download can be cancelled", async () => {
    const decode = vi.fn<
      (
        request: DecodeRequest,
        onProgress?: (loaded: number, total: number) => void,
        signal?: AbortSignal,
      ) => Promise<DecodedChunk>
    >(async (request) => makeDecodedChunk(request.chunkCoords[0]!));
    mockCreateWorker.mockReturnValue({
      decode,
      terminate: vi.fn(),
    } as unknown as ChunkWorkerClient);

    const reader = new ZarrChunkReader(ds);
    await reader.getTimeSeries(makeGrid(50, 50));

    expect(decode.mock.calls[0]![2]).toBeInstanceOf(AbortSignal);
  });

  it("falls back to inline decoding when the worker fails", async () => {
    const decode = vi.fn<
      (request: DecodeRequest) => Promise<DecodedChunk>
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

  it("reports cached years for the picked cell", async () => {
    const reader = new ZarrChunkReader(ds);
    const grid = makeGrid(50, 50);

    expect(reader.getCachedYears(grid).size).toBe(0);

    await reader.getTimeSeries(grid);

    expect(reader.getCachedYears(grid).size).toBeGreaterThan(0);
  });

  it("reports cached years for every cell sharing the patch", async () => {
    const reader = new ZarrChunkReader(ds);
    await reader.getTimeSeries(makeGrid(50, 50));

    // Anywhere in the same 40x40 patch is genuinely already downloaded.
    expect(reader.getCachedYears(makeGrid(60, 60)).size).toBeGreaterThan(0);
    // A different patch is not.
    expect(reader.getCachedYears(makeGrid(80, 80)).size).toBe(0);
  });

  it("fetches multiple years and returns concatenated time series", async () => {
    const reader = new ZarrChunkReader(ds);
    const grid = makeGrid(50, 50);

    const result = await reader.getTimeSeriesForYears(grid, [2018, 2019]);
    expect(result.values).toBeInstanceOf(Float32Array);
    expect(result.variable).toBe("NEE");
  });
});
