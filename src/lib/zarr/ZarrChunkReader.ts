import * as zarr from "zarrita";
import { LRUCache } from "@/lib/cache/lru";
import { ZARR_STORE } from "@/lib/constants/store";
import {
  extractPixelFromNativeChunk,
  nativeChunkKey,
  pixelToNativeChunkContext,
  stitchTimeSeriesForRange,
  type ArrayChunkSizes,
  type AxisSlice,
  type PixelNativeChunkContext,
} from "@/lib/zarr/chunks";
import {
  ChunkWorkerClient,
  type DecodedChunk,
} from "@/lib/zarr/chunkWorkerClient";
import {
  chunkIndexToStartDay,
  DEFAULT_HISTORY_YEARS,
  timeChunkIndexToYears,
  yearsToContiguousBlocks,
  yearsToDayRange,
  yearToDateRange,
} from "@/lib/zarr/timeRange";
import {
  abortError,
  createByteProgressSink,
  isAbortError,
  createSeriesProgressTracker,
  getActiveByteSink,
  setActiveAbortSignal,
  setActiveByteSink,
  type SeriesProgressTracker,
  type ZarrArrayHandle,
  type ZarrStore,
} from "@/lib/zarr/store";
import { deriveGridSpec } from "@/lib/zarr/gridSpec";
import type { GridCell, GridSpec } from "@/types/map";

/**
 * One whole decoded native chunk: every pixel of a 40x40 patch for one time
 * chunk, ~224 MB here.
 *
 * Keeping the patch rather than a window of it is what makes exploring cheap.
 * The patch is exactly the area the map already draws as the dashed box, so
 * every cell the user can see inside it is served without another download.
 */
type CachedPatch = {
  data: Float32Array;
  shape: number[];
  chunkStartDay: number;
};

/**
 * Byte budget for decoded patches. A patch is ~224 MB, so this holds four:
 * enough for a few years at one spot, or a couple of neighbouring patches,
 * without letting a long history selection grow the heap without limit.
 */
const DEFAULT_CACHE_BYTES = 1024 ** 3;

/** Days per native time chunk, matching the store's `[1461, 24, 40, 40]`. */
const NATIVE_TIME_CHUNK = 1461;

/**
 * A decode several callers may be waiting on. The controller is only aborted
 * once every waiter has dropped out, so one caller walking away does not
 * cancel the chunk another still wants.
 */
type InFlightDecode = {
  promise: Promise<CachedPatch>;
  controller: AbortController;
  waiters: number;
};

/** Reports download progress as `loaded` of `total` bytes. */
export type SeriesProgress = (loaded: number, total: number) => void;

type ZarrArray = ZarrArrayHandle & {
  getChunk(
    chunkCoords: number[],
  ): Promise<{ data: Float32Array; shape: number[] }>;
};

export class ZarrChunkReader {
  private ds: ZarrStore;
  private cache: LRUCache<string, CachedPatch>;
  private arrayPromises = new Map<string, Promise<ZarrArray>>();
  private chunkLoadsInFlight = new Map<string, InFlightDecode>();
  private gridSpecPromise?: Promise<GridSpec>;
  private workerClient: ChunkWorkerClient | null = null;
  private workerChecked = false;

  /**
   * Bounded by bytes, not by entry count: one entry here is a ~224 MB patch,
   * so counting entries would be a meaningless proxy for memory.
   */
  constructor(ds: ZarrStore, maxBytes = DEFAULT_CACHE_BYTES) {
    this.ds = ds;
    this.cache = new LRUCache(Number.MAX_SAFE_INTEGER, {
      maxBytes,
      weigh: (patch) => patch.data.byteLength,
    });
  }

  /**
   * Derive the dataset's spatial grid from store metadata, memoized so the
   * coordinate arrays are only read once. Falls back to DEFAULT_GRID_SPEC
   * inside deriveGridSpec if the store cannot be read.
   */
  getGridSpec(variable = ZARR_STORE.defaultVariable): Promise<GridSpec> {
    if (!this.gridSpecPromise) {
      this.gridSpecPromise = deriveGridSpec(this.ds, variable);
    }
    return this.gridSpecPromise;
  }

  /**
   * Main-thread array handle. Used for metadata (shape, chunks, attrs) and,
   * where no worker is available, for decoding too.
   */
  private getArray(variable: string): Promise<ZarrArray> {
    const existing = this.arrayPromises.get(variable);
    if (existing) return existing;

    const promise = zarr
      .open(this.ds.root.resolve(variable), { kind: "array" })
      .then((array) => array as ZarrArray)
      .catch((error) => {
        this.arrayPromises.delete(variable);
        throw error;
      });

    this.arrayPromises.set(variable, promise);
    return promise;
  }

  private getWorker(): ChunkWorkerClient | null {
    if (!this.workerChecked) {
      this.workerClient = ChunkWorkerClient.create();
      this.workerChecked = true;
    }
    return this.workerClient;
  }

  private getChunkSizes(array: ZarrArray): ArrayChunkSizes {
    const [time, hour, lat, lon] = array.chunks;
    return { time, hour, lat, lon };
  }

  /** Release the decode worker; the reader falls back to inline decoding. */
  dispose(): void {
    this.workerClient?.terminate();
    this.workerClient = null;
    this.workerChecked = true;
  }

  /**
   * Decode one native chunk and cache the whole patch.
   *
   * Deduping is keyed by the chunk, since the entry now serves every pixel in
   * it: two callers wanting different cells of the same patch genuinely share
   * one download.
   */
  private loadPatch(
    array: ZarrArray,
    variable: string,
    context: PixelNativeChunkContext,
    timeChunkIdx: number,
    chunkSizes: ArrayChunkSizes,
    tracker: SeriesProgressTracker | null,
    signal: AbortSignal | undefined,
  ): Promise<CachedPatch> {
    const loadKey = this.patchKey(variable, context, timeChunkIdx);

    const existing = this.chunkLoadsInFlight.get(loadKey);
    if (existing) return this.join(existing, signal);

    const chunkCoords = [
      timeChunkIdx,
      0,
      context.chunkLatIdx,
      context.chunkLonIdx,
    ];

    const controller = new AbortController();
    const promise = this.decodeChunk(
      array,
      variable,
      chunkCoords,
      tracker,
      controller.signal,
    )
      .then((decoded) => {
        const patch: CachedPatch = {
          data: decoded.data,
          shape: decoded.shape,
          chunkStartDay: chunkIndexToStartDay(timeChunkIdx, chunkSizes.time),
        };
        this.cache.set(loadKey, patch);
        return patch;
      })
      .finally(() => {
        this.chunkLoadsInFlight.delete(loadKey);
      });

    const entry: InFlightDecode = { promise, controller, waiters: 0 };
    this.chunkLoadsInFlight.set(loadKey, entry);
    return this.join(entry, signal);
  }

  /**
   * Wait on a shared decode. The underlying download is only aborted once the
   * last waiter has given up.
   */
  private join(
    entry: InFlightDecode,
    signal: AbortSignal | undefined,
  ): Promise<CachedPatch> {
    if (!signal) return entry.promise;
    if (signal.aborted) return Promise.reject(abortError());

    entry.waiters += 1;
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      entry.waiters -= 1;
      if (entry.waiters <= 0) entry.controller.abort();
    };

    return new Promise<CachedPatch>((resolve, reject) => {
      const onAbort = () => {
        release();
        reject(abortError());
      };
      signal.addEventListener("abort", onAbort, { once: true });

      entry.promise.then(
        (value) => {
          signal.removeEventListener("abort", onAbort);
          entry.waiters -= 1;
          resolve(value);
        },
        (error) => {
          signal.removeEventListener("abort", onAbort);
          entry.waiters -= 1;
          reject(error);
        },
      );
    });
  }

  /** Cache key for one patch: variable, time chunk, and the lat/lon block. */
  private patchKey(
    variable: string,
    context: PixelNativeChunkContext,
    timeChunkIdx: number,
  ): string {
    return nativeChunkKey(variable, {
      timeChunkIdx,
      hourChunkIdx: 0,
      latChunkIdx: context.chunkLatIdx,
      lonChunkIdx: context.chunkLonIdx,
    });
  }

  /** One cell's series, read out of a cached patch. */
  private pixelSegment(
    patch: CachedPatch,
    context: PixelNativeChunkContext,
  ): { values: Float32Array; chunkStartDay: number } {
    return {
      values: extractPixelFromNativeChunk(patch.data, patch.shape, {
        localLat: context.localLat,
        localLon: context.localLon,
      }),
      chunkStartDay: patch.chunkStartDay,
    };
  }

  /** Decode in the worker where possible, otherwise inline on this thread. */
  private async decodeChunk(
    array: ZarrArray,
    variable: string,
    chunkCoords: number[],
    tracker: SeriesProgressTracker | null,
    signal: AbortSignal,
  ): Promise<DecodedChunk> {
    const worker = this.getWorker();

    if (worker) {
      try {
        return await worker.decode(
          {
            storeUrl: this.ds.url,
            variable,
            chunkCoords,
          },
          tracker ? (loaded, total) => tracker.update(loaded, total) : undefined,
          signal,
        );
      } catch (error) {
        // An abort is the caller's own decision, not a broken worker: let it
        // through rather than retiring the worker and re-fetching inline.
        if (isAbortError(error)) throw error;
        // A worker that fails once (bad module resolution, a store it cannot
        // reach) will keep failing, so retire it and decode inline instead.
        // Slow beats broken.
        this.dispose();
      }
    }

    const sink = tracker
      ? createByteProgressSink((loaded, total) => tracker.update(loaded, total))
      : null;
    if (sink) setActiveByteSink(sink);
    setActiveAbortSignal(signal);
    let chunk: { data: Float32Array; shape: number[] };
    try {
      chunk = await array.getChunk(chunkCoords);
    } finally {
      // Only clear if a newer request has not already swapped in its own sink.
      if (sink && getActiveByteSink() === sink) setActiveByteSink(null);
      setActiveAbortSignal(null);
    }

    return { data: chunk.data, shape: chunk.shape };
  }

  /**
   * Calendar years already held for the patch this cell sits in, so the year
   * selector can show which are free to draw.
   *
   * Patch-scoped on purpose: an entry holds every cell of its 40x40 block, so
   * a year decoded for a neighbour really is available here too, with no
   * download.
   */
  getCachedYears(
    grid: GridCell,
    variable = ZARR_STORE.defaultVariable,
    chunkTime: number = NATIVE_TIME_CHUNK,
  ): Set<number> {
    const cachedYears = new Set<number>();
    const chunkCount = Math.ceil(ZARR_STORE.dimensions.time / chunkTime);
    const latChunkIdx = Math.floor(
      grid.latIndex / ZARR_STORE.nativeChunks.lat,
    );
    const lonChunkIdx = Math.floor(
      grid.lonIndex / ZARR_STORE.nativeChunks.lon,
    );

    for (let chunkIdx = 0; chunkIdx < chunkCount; chunkIdx++) {
      const key = nativeChunkKey(variable, {
        timeChunkIdx: chunkIdx,
        hourChunkIdx: 0,
        latChunkIdx,
        lonChunkIdx,
      });
      if (this.cache.has(key)) {
        for (const year of timeChunkIndexToYears(chunkIdx, chunkTime)) {
          cachedYears.add(year);
        }
      }
    }
    return cachedYears;
  }

  async getTimeSeriesForRange(
    grid: GridCell,
    timeRange: AxisSlice,
    variable = ZARR_STORE.defaultVariable,
    onProgress?: SeriesProgress,
    signal?: AbortSignal,
  ): Promise<{ values: Float32Array; variable: string; units?: string }> {
    const array = await this.getArray(variable);
    const chunkSizes = this.getChunkSizes(array);
    const [timeCount, hourCount] = array.shape;
    const context = pixelToNativeChunkContext(
      grid.latIndex,
      grid.lonIndex,
      timeCount,
      chunkSizes,
      timeRange,
    );
    const units =
      typeof array.attrs.units === "string" ? array.attrs.units : undefined;

    const keyFor = (timeChunkIdx: number) =>
      this.patchKey(variable, context, timeChunkIdx);

    const missingCount = context.timeChunkIndices.filter(
      (timeChunkIdx) => !this.cache.has(keyFor(timeChunkIdx)),
    ).length;

    if (onProgress && missingCount === 0) onProgress(1, 1);
    const tracker =
      onProgress && missingCount > 0
        ? createSeriesProgressTracker(missingCount, onProgress)
        : null;

    // Sequential on purpose: one decoded chunk resident at a time. Fetching
    // all of them at once is what exhausted memory on mobile.
    const segments: { values: Float32Array; chunkStartDay: number }[] = [];
    for (const timeChunkIdx of context.timeChunkIndices) {
      // Stop between chunks too, so an abandoned request does not start the
      // next download after the current one was already paid for.
      if (signal?.aborted) throw abortError();

      const cached = this.cache.get(keyFor(timeChunkIdx));
      if (cached) {
        segments.push(this.pixelSegment(cached, context));
        continue;
      }

      const patch = await this.loadPatch(
        array,
        variable,
        context,
        timeChunkIdx,
        chunkSizes,
        tracker,
        signal,
      );
      segments.push(this.pixelSegment(patch, context));
      tracker?.complete();
    }

    return {
      values: stitchTimeSeriesForRange(segments, timeRange, hourCount),
      variable,
      units,
    };
  }

  async getTimeSeriesForYear(
    grid: GridCell,
    year: number,
    variable = ZARR_STORE.defaultVariable,
    onProgress?: SeriesProgress,
    signal?: AbortSignal,
  ): Promise<{ values: Float32Array; variable: string; units?: string }> {
    const timeRange = yearToDateRange(year);
    return this.getTimeSeriesForRange(
      grid,
      timeRange,
      variable,
      onProgress,
      signal,
    );
  }

  async getTimeSeriesForYears(
    grid: GridCell,
    years: number[],
    variable = ZARR_STORE.defaultVariable,
    onProgress?: SeriesProgress,
    signal?: AbortSignal,
  ): Promise<{ values: Float32Array; variable: string; units?: string }> {
    if (years.length === 0) {
      return { values: new Float32Array(0), variable };
    }
    const blocks = yearsToContiguousBlocks(years);
    if (blocks.length === 1) {
      const block = blocks[0]!;
      const timeRange: AxisSlice = [
        yearToDateRange(block[0]!)[0],
        yearToDateRange(block[block.length - 1]!)[1],
      ];
      return this.getTimeSeriesForRange(
        grid,
        timeRange,
        variable,
        onProgress,
        signal,
      );
    }

    let totalLen = 0;
    const results: Float32Array[] = [];
    let resolvedUnits: string | undefined;

    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i]!;
      const timeRange: AxisSlice = [
        yearToDateRange(block[0]!)[0],
        yearToDateRange(block[block.length - 1]!)[1],
      ];
      const res = await this.getTimeSeriesForRange(
        grid,
        timeRange,
        variable,
        undefined,
        signal,
      );
      results.push(res.values);
      totalLen += res.values.length;
      if (res.units) resolvedUnits = res.units;
    }

    const merged = new Float32Array(totalLen);
    let offset = 0;
    for (const arr of results) {
      merged.set(arr, offset);
      offset += arr.length;
    }

    onProgress?.(1, 1);
    return { values: merged, variable, units: resolvedUnits };
  }

  async getTimeSeries(
    grid: GridCell,
    variable = ZARR_STORE.defaultVariable,
    historyYears?: number,
    onProgress?: SeriesProgress,
    signal?: AbortSignal,
  ): Promise<{ values: Float32Array; variable: string; units?: string }> {
    const array = await this.getArray(variable);
    const [timeCount] = array.shape;
    const timeRange = yearsToDayRange(
      historyYears ?? DEFAULT_HISTORY_YEARS,
      timeCount,
    );
    return this.getTimeSeriesForRange(
      grid,
      timeRange,
      variable,
      onProgress,
      signal,
    );
  }
}
