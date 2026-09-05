import * as zarr from "zarrita";
import { LRUCache } from "@/lib/cache/lru";
import { ZARR_STORE } from "@/lib/constants/store";
import {
  extractBlockFromNativeChunk,
  neighborhoodBlock,
  pixelSeriesKey,
  pixelToNativeChunkContext,
  stitchTimeSeriesForRange,
  type ArrayChunkSizes,
  type AxisSlice,
  type LocalBlock,
  type PixelNativeChunkContext,
} from "@/lib/zarr/chunks";
import { ChunkWorkerClient, type DecodedBlock } from "@/lib/zarr/chunkWorkerClient";
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
 * One pixel's values for one native time chunk: `chunkTime * hourCount`
 * floats, ~140 KB here. The chunk it came from is ~224 MB and is never kept.
 */
type CachedPixelSeries = {
  values: Float32Array;
  chunkStartDay: number;
};

/**
 * Pixels within this many cells of the requested one are harvested from the
 * same decoded chunk. Decoding is the expensive step, so a 5x5 window costs
 * ~3.5 MB of extra transfer and saves a 182 MB refetch when the user explores
 * neighbouring cells.
 */
const NEIGHBORHOOD_RADIUS = 2;

/** Days per native time chunk, matching the store's `[1461, 24, 40, 40]`. */
const NATIVE_TIME_CHUNK = 1461;

/**
 * A decode several callers may be waiting on. The controller is only aborted
 * once every waiter has dropped out, so one caller walking away does not
 * cancel the chunk another still wants.
 */
type InFlightDecode = {
  promise: Promise<CachedPixelSeries>;
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
  private cache: LRUCache<string, CachedPixelSeries>;
  private arrayPromises = new Map<string, Promise<ZarrArray>>();
  private chunkLoadsInFlight = new Map<string, InFlightDecode>();
  private gridSpecPromise?: Promise<GridSpec>;
  private workerClient: ChunkWorkerClient | null = null;
  private workerChecked = false;

  /**
   * Entries are a fixed ~140 KB (one pixel, one native time chunk), so the
   * default caps the decoded cache near 72 MB, and one full-history pixel
   * occupies 6 of them.
   */
  constructor(ds: ZarrStore, maxCacheSize = 512) {
    this.ds = ds;
    this.cache = new LRUCache(maxCacheSize);
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
   * Decode one native chunk, return the requested pixel's slice of it, and
   * cache the surrounding neighbourhood on the way past.
   *
   * The requested pixel is read straight out of the decoded block rather than
   * back out of the cache, so a request never depends on what the cache chose
   * to retain. Deduping is keyed by pixel, not by chunk: two pixels share a
   * chunk but not a neighbourhood, and awaiting a neighbour's load would leave
   * this pixel unharvested.
   */
  private loadPixelSeries(
    array: ZarrArray,
    variable: string,
    context: PixelNativeChunkContext,
    timeChunkIdx: number,
    chunkSizes: ArrayChunkSizes,
    tracker: SeriesProgressTracker | null,
    signal: AbortSignal | undefined,
  ): Promise<CachedPixelSeries> {
    const loadKey = `${variable}:${timeChunkIdx}:${context.chunkLatIdx}:${context.chunkLonIdx}:${context.localLat}:${context.localLon}`;

    const existing = this.chunkLoadsInFlight.get(loadKey);
    if (existing) return this.join(existing, signal);

    const chunkCoords = [
      timeChunkIdx,
      0,
      context.chunkLatIdx,
      context.chunkLonIdx,
    ];

    const controller = new AbortController();
    const promise = this.decodeBlock(
      array,
      variable,
      chunkCoords,
      context,
      tracker,
      controller.signal,
    )
      .then((decoded) => {
        this.storeNeighborhood(
          variable,
          context,
          timeChunkIdx,
          chunkSizes,
          decoded,
        );
        return this.pixelFromBlock(decoded, context, timeChunkIdx, chunkSizes);
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
  ): Promise<CachedPixelSeries> {
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

    return new Promise<CachedPixelSeries>((resolve, reject) => {
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

  /** The requested pixel's own series, read out of the harvested block. */
  private pixelFromBlock(
    decoded: DecodedBlock,
    context: PixelNativeChunkContext,
    timeChunkIdx: number,
    chunkSizes: ArrayChunkSizes,
  ): CachedPixelSeries {
    const { block, seriesLength, values } = decoded;
    const lat = context.localLat - block.localLatStart;
    const lon = context.localLon - block.localLonStart;
    const offset = (lat * block.localLonCount + lon) * seriesLength;

    return {
      values: values.slice(offset, offset + seriesLength),
      chunkStartDay: chunkIndexToStartDay(timeChunkIdx, chunkSizes.time),
    };
  }

  /** Decode in the worker where possible, otherwise inline on this thread. */
  private async decodeBlock(
    array: ZarrArray,
    variable: string,
    chunkCoords: number[],
    context: PixelNativeChunkContext,
    tracker: SeriesProgressTracker | null,
    signal: AbortSignal,
  ): Promise<DecodedBlock> {
    const worker = this.getWorker();

    if (worker) {
      try {
        return await worker.decode(
          {
            storeUrl: this.ds.url,
            variable,
            chunkCoords,
            localLat: context.localLat,
            localLon: context.localLon,
            radius: NEIGHBORHOOD_RADIUS,
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

    const block = neighborhoodBlock(
      { localLat: context.localLat, localLon: context.localLon },
      NEIGHBORHOOD_RADIUS,
      chunk.shape,
    );

    return {
      block,
      seriesLength: chunk.shape[0]! * chunk.shape[1]!,
      values: extractBlockFromNativeChunk(chunk.data, chunk.shape, block),
    };
  }

  /** Split a decoded neighbourhood into one cache entry per pixel. */
  private storeNeighborhood(
    variable: string,
    context: PixelNativeChunkContext,
    timeChunkIdx: number,
    chunkSizes: ArrayChunkSizes,
    decoded: DecodedBlock,
  ): void {
    const { block, seriesLength, values } = decoded;
    const chunkStartDay = chunkIndexToStartDay(timeChunkIdx, chunkSizes.time);
    const latOrigin = context.chunkLatIdx * chunkSizes.lat;
    const lonOrigin = context.chunkLonIdx * chunkSizes.lon;

    let offset = 0;
    for (let lat = 0; lat < block.localLatCount; lat++) {
      for (let lon = 0; lon < block.localLonCount; lon++) {
        const key = pixelSeriesKey(
          variable,
          latOrigin + block.localLatStart + lat,
          lonOrigin + block.localLonStart + lon,
          timeChunkIdx,
        );
        this.cache.set(key, {
          // slice(), not subarray(), so evicting one pixel frees its memory
          // instead of pinning the whole neighbourhood buffer.
          values: values.slice(offset, offset + seriesLength),
          chunkStartDay,
        });
        offset += seriesLength;
      }
    }
  }

  /**
   * Calendar years already held for this exact cell, so the year selector can
   * show which are free to draw.
   *
   * The cache is keyed per pixel rather than per native chunk, so this asks
   * about the picked cell itself: a neighbour having been decoded says nothing
   * about whether this cell's series is resident.
   */
  getCachedYears(
    grid: GridCell,
    variable = ZARR_STORE.defaultVariable,
    chunkTime: number = NATIVE_TIME_CHUNK,
  ): Set<number> {
    const cachedYears = new Set<number>();
    const chunkCount = Math.ceil(ZARR_STORE.dimensions.time / chunkTime);

    for (let chunkIdx = 0; chunkIdx < chunkCount; chunkIdx++) {
      const key = pixelSeriesKey(
        variable,
        grid.latIndex,
        grid.lonIndex,
        chunkIdx,
      );
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
      pixelSeriesKey(variable, grid.latIndex, grid.lonIndex, timeChunkIdx);

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
    const segments: CachedPixelSeries[] = [];
    for (const timeChunkIdx of context.timeChunkIndices) {
      // Stop between chunks too, so an abandoned request does not start the
      // next download after the current one was already paid for.
      if (signal?.aborted) throw abortError();

      const cached = this.cache.get(keyFor(timeChunkIdx));
      if (cached) {
        segments.push(cached);
        continue;
      }

      segments.push(
        await this.loadPixelSeries(
          array,
          variable,
          context,
          timeChunkIdx,
          chunkSizes,
          tracker,
          signal,
        ),
      );
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

export type { LocalBlock };
