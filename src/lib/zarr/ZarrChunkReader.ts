import * as zarr from "zarrita";
import { LRUCache } from "@/lib/cache/lru";
import { ZARR_STORE } from "@/lib/constants/store";
import {
  alignedSubBlock,
  blockCoversChunk,
  extractPixelFromNativeChunk,
  nativeChunkKey,
  pixelToNativeChunkContext,
  sliceBlockFromNativeChunk,
  stitchTimeSeriesForRange,
  subBlockIndices,
  type ArrayChunkSizes,
  type AxisSlice,
  type LocalBlock,
  type PixelNativeChunkContext,
} from "@/lib/zarr/chunks";
import {
  ChunkWorkerClient,
  type DecodedChunk,
} from "@/lib/zarr/chunkWorkerClient";
import {
  chunkIndexToStartDay,
  DEFAULT_HISTORY_YEARS,
  NATIVE_TIME_CHUNK,
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
import {
  cacheBytesFor,
  DEFAULT_PATCH_WINDOW,
  DESKTOP_CACHE_BYTES,
} from "@/lib/settings/patchWindow";
import type { GridCell, GridSpec } from "@/types/map";

/**
 * One decoded patch: every pixel of a window-aligned tile of a native chunk,
 * for one time chunk. A tile is the whole 40x40 chunk at the largest window
 * (~224 MB) down to 10x10 at the smallest (~14 MB).
 *
 * Keeping a tile rather than a single cell is what makes exploring cheap: the
 * map draws the tile as the dashed box, and every cell inside it is served
 * without another download. How big that box is, is the caller's choice.
 */
type CachedPatch = {
  data: Float32Array;
  shape: number[];
  block: LocalBlock;
  chunkStartDay: number;
};

export type ZarrChunkReaderOptions = {
  /** Cells kept per side of a downloaded patch. See `@/lib/settings/patchWindow`. */
  windowSize?: number;
  /**
   * Byte budget for decoded patches. Defaults to the desktop budget raised, if
   * need be, to hold one spot's full history, since a budget under that evicts
   * the patch it is about to ask for again.
   */
  maxBytes?: number;
};

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
  private windowSize: number;
  private maxBytes: number;

  /**
   * Bounded by bytes, not by entry count: one entry here is a patch of up to
   * ~224 MB, so counting entries would be a meaningless proxy for memory.
   *
   * The legacy number form is a byte budget, kept so existing callers read the
   * same.
   */
  constructor(ds: ZarrStore, options: number | ZarrChunkReaderOptions = {}) {
    const resolved =
      typeof options === "number" ? { maxBytes: options } : options;

    this.ds = ds;
    this.windowSize = resolved.windowSize ?? DEFAULT_PATCH_WINDOW;
    this.maxBytes =
      resolved.maxBytes ?? cacheBytesFor(this.windowSize, DESKTOP_CACHE_BYTES);
    this.cache = this.createCache();
  }

  private createCache(): LRUCache<string, CachedPatch> {
    return new LRUCache(Number.MAX_SAFE_INTEGER, {
      maxBytes: this.maxBytes,
      weigh: (patch) => patch.data.byteLength,
    });
  }

  /** Cells kept per side of a downloaded patch. */
  getWindowSize(): number {
    return this.windowSize;
  }

  /**
   * Change how much of each patch is kept.
   *
   * The cache is dropped rather than converted: entries are keyed and shaped by
   * the window they were cut with, and a smaller window cannot be re-cut from a
   * larger one without keeping the larger one resident, which is the memory the
   * change was asked for in the first place.
   */
  setWindowSize(windowSize: number, maxBytes?: number): void {
    if (windowSize === this.windowSize && maxBytes === undefined) return;

    this.windowSize = windowSize;
    this.maxBytes = maxBytes ?? cacheBytesFor(windowSize, DESKTOP_CACHE_BYTES);
    this.cache = this.createCache();
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
   * Decode one native chunk and cache the window kept from it.
   *
   * Deduping is keyed by that window, since the entry serves every pixel in it:
   * two callers wanting different cells of one window genuinely share a single
   * download.
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

    // A decode whose last waiter walked away is already cancelled: joining it
    // would hand this caller the abort meant for someone else.
    const existing = this.chunkLoadsInFlight.get(loadKey);
    if (existing && !existing.controller.signal.aborted) {
      return this.join(loadKey, existing, signal);
    }

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
      context,
      tracker,
      controller.signal,
    )
      .then((decoded) => {
        const patch: CachedPatch = {
          data: decoded.data,
          shape: decoded.shape,
          block: decoded.block,
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
    return this.join(loadKey, entry, signal);
  }

  /**
   * Wait on a shared decode. The underlying download is only aborted once the
   * last waiter has given up.
   */
  private join(
    key: string,
    entry: InFlightDecode,
    signal: AbortSignal | undefined,
  ): Promise<CachedPatch> {
    if (!signal) return entry.promise;
    if (signal.aborted) return Promise.reject(abortError());

    entry.waiters += 1;
    let released = false;
    const release = (cancel: boolean) => {
      if (released) return;
      released = true;
      entry.waiters -= 1;
      if (!cancel || entry.waiters > 0) return;

      entry.controller.abort();
      // Retire it here rather than waiting for the rejection to land: a caller
      // arriving in between would otherwise join a decode that is already
      // cancelled and be handed an abort it never asked for. That is what left
      // the panel blank when a year click was followed straight by a range
      // selection over the same chunk.
      if (this.chunkLoadsInFlight.get(key) === entry) {
        this.chunkLoadsInFlight.delete(key);
      }
    };

    return new Promise<CachedPatch>((resolve, reject) => {
      const onAbort = () => {
        release(true);
        reject(abortError());
      };
      signal.addEventListener("abort", onAbort, { once: true });

      entry.promise.then(
        (value) => {
          signal.removeEventListener("abort", onAbort);
          release(false);
          resolve(value);
        },
        (error) => {
          signal.removeEventListener("abort", onAbort);
          release(false);
          reject(error);
        },
      );
    });
  }

  /**
   * Cache key for one patch: variable, time chunk, the lat/lon chunk, and the
   * window-aligned tile of it that was kept.
   *
   * The tile indices come from the pixel alone, so the key is known before the
   * chunk is decoded and two cells of one tile agree on it.
   */
  private patchKey(
    variable: string,
    context: PixelNativeChunkContext,
    timeChunkIdx: number,
  ): string {
    const { subLatIdx, subLonIdx } = subBlockIndices(context, this.windowSize);
    return nativeChunkKey(variable, {
      timeChunkIdx,
      hourChunkIdx: 0,
      latChunkIdx: context.chunkLatIdx,
      lonChunkIdx: context.chunkLonIdx,
      subLatIdx,
      subLonIdx,
    });
  }

  /**
   * One cell's series, read out of a cached patch. Offsets are rebased onto the
   * patch's own origin, which is the chunk's when the whole chunk was kept.
   */
  private pixelSegment(
    patch: CachedPatch,
    context: PixelNativeChunkContext,
  ): { values: Float32Array; chunkStartDay: number } {
    return {
      values: extractPixelFromNativeChunk(patch.data, patch.shape, {
        localLat: context.localLat - patch.block.localLatStart,
        localLon: context.localLon - patch.block.localLonStart,
      }),
      chunkStartDay: patch.chunkStartDay,
    };
  }

  /** Decode in the worker where possible, otherwise inline on this thread. */
  private async decodeChunk(
    array: ZarrArray,
    variable: string,
    chunkCoords: number[],
    context: PixelNativeChunkContext,
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
            windowSize: this.windowSize,
            localLat: context.localLat,
            localLon: context.localLon,
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

    // Same cut the worker makes, so a cached patch has one shape whichever
    // path decoded it.
    const block = alignedSubBlock(context, this.windowSize, chunk.shape);
    if (blockCoversChunk(block, chunk.shape)) {
      return { data: chunk.data, shape: chunk.shape, block };
    }

    const kept = sliceBlockFromNativeChunk(chunk.data, chunk.shape, block);
    return { data: kept.data, shape: kept.shape, block };
  }

  /**
   * Calendar years already held for the patch this cell sits in, so the year
   * selector can show which are free to draw.
   *
   * Patch-scoped on purpose: an entry holds every cell of its window, so a year
   * decoded for a neighbour in the same window really is available here too,
   * with no download.
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
    const { subLatIdx, subLonIdx } = subBlockIndices(
      {
        localLat: grid.latIndex - latChunkIdx * ZARR_STORE.nativeChunks.lat,
        localLon: grid.lonIndex - lonChunkIdx * ZARR_STORE.nativeChunks.lon,
      },
      this.windowSize,
    );

    for (let chunkIdx = 0; chunkIdx < chunkCount; chunkIdx++) {
      const key = nativeChunkKey(variable, {
        timeChunkIdx: chunkIdx,
        hourChunkIdx: 0,
        latChunkIdx,
        lonChunkIdx,
        subLatIdx,
        subLonIdx,
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
