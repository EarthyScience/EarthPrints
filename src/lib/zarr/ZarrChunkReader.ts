import * as zarr from "zarrita";
import { LRUCache } from "@/lib/cache/lru";
import { ZARR_STORE } from "@/lib/constants/store";
import {
  extractPixelFromNativeChunk,
  listTimeChunkIndicesForRange,
  nativeChunkKey,
  pixelToNativeChunkContext,
  stitchTimeSeriesForRange,
  subBlockIndices,
  type ArrayChunkSizes,
  type AxisSlice,
  type ChunkPlan,
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
  yearsToContiguousBlocks,
  yearsToDayRange,
  yearToDateRange,
  ZARR_TIME_ORIGIN_UTC,
} from "@/lib/zarr/timeRange";
import { DatasetError, type Dataset, type DatasetDecode } from "@/lib/zarr/dataset";
import { readPatch, type ChunkSource } from "@/lib/zarr/patch";
import {
  resampleToDays,
  sampleRangeForDays,
  type TimeAxis,
} from "@/lib/zarr/timeAxis";
import {
  abortError,
  createByteProgressSink,
  createConcurrentProgressTracker,
  isAbortError,
  createSeriesProgressTracker,
  withRequestContext,
  type SeriesProgressTracker,
  type ZarrArrayHandle,
  type ZarrStore,
} from "@/lib/zarr/store";
import { deriveGridSpec } from "@/lib/zarr/gridSpec";
import { DEFAULT_GRID_SPEC } from "@/lib/constants/store";
import {
  cacheBytesFor,
  DEFAULT_PATCH_WINDOW,
  DESKTOP_CACHE_BYTES,
} from "@/lib/settings/patchWindow";
import type { GridCell, GridSpec } from "@/types/map";

/**
 * One decoded patch: every pixel of a window-aligned tile of a native chunk,
 * for one time chunk, as `[time, hour, lat, lon]` Float32. For FLUXCOM-X a
 * tile is the whole 40x40 chunk at the largest window (~224 MB) down to 10x10
 * at the smallest (~14 MB).
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
  /**
   * What the store holds and how to read it. Without it the store is read as
   * FLUXCOM-X: `[time, hour, lat, lon]` with one day per time step.
   */
  dataset?: Dataset;
};

/**
 * Most stored chunks one series may need. A store chunked by map rather than
 * by time costs one download per time step for a single pixel, which at
 * 6-hourly resolution is 1460 a year; past this the request is refused with
 * the reason rather than left to crawl.
 */
export const MAX_CHUNKS_PER_SERIES = 400;

/** Largest stored chunk, decoded, that one download may unpack. */
export const MAX_CHUNK_BYTES = 1.5 * 1024 ** 3;

/**
 * Many chunks this small are bound by latency rather than memory, so several
 * download at once. A store chunked by map lands here; FLUXCOM-X never does.
 */
const SMALL_CHUNK_BYTES = 32 * 1024 ** 2;
const SMALL_CHUNK_RUN = 8;
const SMALL_CHUNK_CONCURRENCY = 12;

const PLAIN_DECODE: DatasetDecode = { scale: 1, offset: 0, fill: [] };

/**
 * A series that needs more downloads than one load may make. `partialDays` is
 * how much of the request the budget does cover, read from the start, so the
 * caller can offer that instead.
 */
export class SeriesBudgetError extends DatasetError {
  constructor(
    message: string,
    readonly partialDays: number,
  ) {
    super(message);
    this.name = "SeriesBudgetError";
  }
}

export type SeriesOptions = {
  /** Over budget, load what the budget covers from the start instead of failing. */
  partial?: boolean;
  /** Downloads left for this load, shared across the blocks of a year selection. */
  budget?: { remaining: number };
};

export type SeriesResult = {
  values: Float32Array;
  variable: string;
  units?: string;
  /** Days actually read, from the start, when a partial load stopped short. */
  coveredDays?: number;
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

type ZarrArray = ZarrArrayHandle & ChunkSource;

/** The FLUXCOM-X reading of an array, for a reader given no dataset. */
function fluxcomTimeAxis(array: ZarrArray): TimeAxis {
  const [days = 0, hours = 24] = array.shape;
  return {
    originMs: ZARR_TIME_ORIGIN_UTC,
    totalDays: days,
    slotsPerDay: hours,
    samplePos: Float64Array.from({ length: days }, (_, i) => i),
    hourAxis: true,
    span: "slot",
    stepDays: 1,
    stepLabel: "hourly",
    years: [],
  };
}

export class ZarrChunkReader {
  private ds: ZarrStore;
  private dataset: Dataset | null;
  /** Picked index on each extra axis (ensemble member, level), by axis. */
  private extraIndices = new Map<number, number>();
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
    this.dataset = resolved.dataset ?? null;
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
  getGridSpec(variable = this.defaultVariable()): Promise<GridSpec> {
    if (this.dataset) return Promise.resolve(this.dataset.grid);
    if (!this.gridSpecPromise) {
      this.gridSpecPromise = deriveGridSpec(this.ds, variable);
    }
    return this.gridSpecPromise;
  }

  getDataset(): Dataset | null {
    return this.dataset;
  }

  private defaultVariable(): string {
    return this.dataset?.variable ?? ZARR_STORE.defaultVariable;
  }

  /**
   * Pick one index on an extra axis. Patches are keyed by the pick, so other
   * members stay cached and switching back is free.
   */
  setExtraIndex(axis: number, index: number): void {
    this.extraIndices.set(axis, index);
  }

  getExtraIndex(axis: number): number {
    return this.extraIndices.get(axis) ?? 0;
  }

  /** Cache key prefix: the array plus every extra-axis pick. */
  private seriesKey(variable: string): string {
    const extras = this.dataset?.layout.extras ?? [];
    const picks = extras.map((dim) => `${dim.axis}=${this.getExtraIndex(dim.axis)}`);
    return [this.ds.url, variable, ...picks].join("|");
  }

  private plan(array: ZarrArray): ChunkPlan {
    const layout = this.dataset?.layout;
    if (!layout) return { time: 0, hour: 1, lat: 2, lon: 3, fixed: [] };
    return {
      time: layout.time,
      hour: layout.hour,
      lat: layout.lat,
      lon: layout.lon,
      fixed: layout.extras.map((dim) => ({
        axis: dim.axis,
        local: this.getExtraIndex(dim.axis) % array.chunks[dim.axis]!,
      })),
    };
  }

  private timeAxis(array: ZarrArray): TimeAxis {
    return this.dataset?.time ?? fluxcomTimeAxis(array);
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
    const layout = this.dataset?.layout ?? { time: 0, hour: 1, lat: 2, lon: 3 };
    const chunk = (axis: number) => (axis >= 0 ? array.chunks[axis]! : 1);
    return {
      time: chunk(layout.time),
      hour: chunk(layout.hour),
      lat: chunk(layout.lat),
      lon: chunk(layout.lon),
    };
  }

  /** Stored chunk coordinates for one time chunk of the pixel's patch. */
  private chunkCoordsFor(
    array: ZarrArray,
    context: PixelNativeChunkContext,
    timeChunkIdx: number,
  ): number[] {
    const layout = this.dataset?.layout ?? { time: 0, hour: 1, lat: 2, lon: 3, extras: [] };
    const coords = new Array<number>(array.shape.length).fill(0);
    coords[layout.time] = timeChunkIdx;
    coords[layout.lat] = context.chunkLatIdx;
    coords[layout.lon] = context.chunkLonIdx;
    for (const dim of layout.extras) {
      coords[dim.axis] = Math.floor(this.getExtraIndex(dim.axis) / array.chunks[dim.axis]!);
    }
    return coords;
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

    const chunkCoords = this.chunkCoordsFor(array, context, timeChunkIdx);

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
    return nativeChunkKey(this.seriesKey(variable), {
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

  /** Bytes one stored chunk takes once decoded, before the window is cut. */
  private rawChunkBytes(array: ZarrArray): number {
    const bytesPerValue = this.dataset?.bytesPerValue ?? 4;
    return array.chunks.reduce((total, size) => total * size, bytesPerValue);
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
    const request = {
      chunkCoords,
      plan: this.plan(array),
      decode: this.dataset?.decode ?? PLAIN_DECODE,
      windowSize: this.windowSize,
      localLat: context.localLat,
      localLon: context.localLon,
    };

    if (worker) {
      try {
        return await worker.decode(
          {
            ...request,
            storeUrl: this.ds.url,
            variable,
            concurrent: this.rawChunkBytes(array) <= SMALL_CHUNK_BYTES,
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
    return withRequestContext(sink, signal, (init) => readPatch(array, request, init));
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
    variable = this.defaultVariable(),
  ): Set<number> {
    const cachedYears = new Set<number>();
    const dataset = this.dataset;
    const spec = dataset?.grid ?? DEFAULT_GRID_SPEC;
    const chunkTime = dataset ? dataset.chunks[dataset.layout.time]! : 1461;
    const sampleCount = dataset
      ? dataset.shape[dataset.layout.time]!
      : ZARR_STORE.dimensions.time;
    const years = dataset?.time.years ?? ALL_FLUXCOM_YEARS;
    const latChunkIdx = Math.floor(grid.latIndex / spec.nativeChunks.lat);
    const lonChunkIdx = Math.floor(grid.lonIndex / spec.nativeChunks.lon);
    const context = {
      chunkLatIdx: latChunkIdx,
      chunkLonIdx: lonChunkIdx,
      localLat: grid.latIndex - latChunkIdx * spec.nativeChunks.lat,
      localLon: grid.lonIndex - lonChunkIdx * spec.nativeChunks.lon,
      timeChunkIndices: [],
    };

    for (const year of years) {
      const days = yearToDateRange(year);
      const samples = dataset ? sampleRangeForDays(dataset.time, days) : days;
      const chunks = listTimeChunkIndicesForRange(samples, chunkTime, sampleCount);
      if (
        chunks.length > 0 &&
        chunks.every((chunk) => this.cache.has(this.patchKey(variable, context, chunk)))
      ) {
        cachedYears.add(year);
      }
    }
    return cachedYears;
  }

  /**
   * One pixel's values over the days `[d0, d1)`, laid out `days x slots`
   * whatever the store's own time layout.
   */
  async getTimeSeriesForRange(
    grid: GridCell,
    dayRange: AxisSlice,
    variable = this.defaultVariable(),
    onProgress?: SeriesProgress,
    signal?: AbortSignal,
    options: SeriesOptions = {},
  ): Promise<SeriesResult> {
    const array = await this.getArray(variable);
    const axis = this.timeAxis(array);
    const chunkSizes = this.getChunkSizes(array);
    const layout = this.dataset?.layout;
    const timeCount = array.shape[layout?.time ?? 0]!;
    const hourCount = layout ? (layout.hour >= 0 ? array.shape[layout.hour]! : 1) : array.shape[1]!;
    if (layout && layout.hour >= 0 && chunkSizes.hour !== hourCount) {
      throw new DatasetError(
        "The hour axis is split across chunks, which this reader cannot stitch yet.",
      );
    }

    let sampleRange = sampleRangeForDays(axis, dayRange);
    const context = pixelToNativeChunkContext(
      grid.latIndex,
      grid.lonIndex,
      timeCount,
      chunkSizes,
      sampleRange,
    );
    const units =
      typeof array.attrs.units === "string" ? array.attrs.units : undefined;

    const keyFor = (timeChunkIdx: number) =>
      this.patchKey(variable, context, timeChunkIdx);

    let missing = context.timeChunkIndices.filter(
      (timeChunkIdx) => !this.cache.has(keyFor(timeChunkIdx)),
    );
    this.checkChunkSize(array);

    const budget = options.budget ?? { remaining: MAX_CHUNKS_PER_SERIES };
    let coveredDays: number | undefined;
    if (missing.length > budget.remaining) {
      // The chunks the budget reaches, in time order, cached ones for free.
      const kept: number[] = [];
      let paid = 0;
      for (const index of context.timeChunkIndices) {
        const free = this.cache.has(keyFor(index));
        if (!free && paid === budget.remaining) break;
        if (!free) paid += 1;
        kept.push(index);
      }
      const stopSample = Math.min(
        sampleRange[1],
        ((kept.at(-1) ?? -1) + 1) * chunkSizes.time,
      );
      const stopPos = axis.samplePos[stopSample];
      coveredDays = Math.max(
        0,
        Math.min(dayRange[1], stopPos === undefined ? dayRange[1] : Math.floor(stopPos)) -
          dayRange[0],
      );
      if (!options.partial) {
        throw new SeriesBudgetError(budgetMessage(missing.length, dayRange), coveredDays);
      }
      context.timeChunkIndices = kept;
      missing = kept.filter((index) => !this.cache.has(keyFor(index)));
      sampleRange = [sampleRange[0], Math.max(sampleRange[0], stopSample)];
    }
    budget.remaining -= missing.length;

    if (onProgress && missing.length === 0) onProgress(1, 1);
    // Large chunks go one at a time, so only one decoded chunk is resident:
    // fetching them all at once is what exhausted memory on mobile. Small
    // ones are bound by latency instead, so a few run side by side.
    const concurrency =
      this.rawChunkBytes(array) <= SMALL_CHUNK_BYTES && missing.length >= SMALL_CHUNK_RUN
        ? SMALL_CHUNK_CONCURRENCY
        : 1;
    const tracker =
      onProgress && missing.length > 0 && concurrency === 1
        ? createSeriesProgressTracker(missing.length, onProgress)
        : null;
    const concurrentTracker =
      onProgress && missing.length > 0 && concurrency > 1
        ? createConcurrentProgressTracker(missing.length, onProgress)
        : null;

    const segments = new Map<number, { values: Float32Array; chunkStartDay: number }>();
    const take = (timeChunkIdx: number, patch: CachedPatch) =>
      segments.set(timeChunkIdx, this.pixelSegment(patch, context));

    for (const timeChunkIdx of context.timeChunkIndices) {
      const cached = this.cache.get(keyFor(timeChunkIdx));
      if (cached) take(timeChunkIdx, cached);
    }

    const queue = [...missing];
    const run = async () => {
      for (let next = queue.shift(); next !== undefined; next = queue.shift()) {
        // Stop between chunks too, so an abandoned request does not start the
        // next download after the current one was already paid for.
        if (signal?.aborted) throw abortError();
        const chunkTracker = concurrentTracker?.start() ?? tracker;
        const patch = await this.loadPatch(
          array,
          variable,
          context,
          next,
          chunkSizes,
          chunkTracker,
          signal,
        );
        take(next, patch);
        chunkTracker?.complete();
      }
    };
    await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, run));

    const ordered = context.timeChunkIndices
      .map((index) => segments.get(index))
      .filter((segment) => segment !== undefined);
    const samples = stitchTimeSeriesForRange(ordered, sampleRange, hourCount);

    return {
      values: resampleToDays(axis, samples, sampleRange[0], dayRange),
      variable,
      units,
      coveredDays,
    };
  }

  /** Refuse a chunk too big to decode in a tab, saying why. */
  private checkChunkSize(array: ZarrArray) {
    const rawBytes = this.rawChunkBytes(array);
    if (rawBytes > MAX_CHUNK_BYTES) {
      throw new DatasetError(
        `One stored chunk of this array is ${formatMB(rawBytes)} once decoded, more than a browser tab can hold. EarthPrints needs smaller chunks.`,
      );
    }
  }

  async getTimeSeriesForYear(
    grid: GridCell,
    year: number,
    variable = this.defaultVariable(),
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
    variable = this.defaultVariable(),
    onProgress?: SeriesProgress,
    signal?: AbortSignal,
    options: SeriesOptions = {},
  ): Promise<SeriesResult> {
    if (years.length === 0) {
      return { values: new Float32Array(0), variable };
    }
    const shared: SeriesOptions = {
      ...options,
      budget: options.budget ?? { remaining: MAX_CHUNKS_PER_SERIES },
    };
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
        shared,
      );
    }

    let totalLen = 0;
    const results: Float32Array[] = [];
    let resolvedUnits: string | undefined;
    let coveredDays: number | undefined;

    // Blocks load one after another, so blocks not yet started are estimated
    // at the average size of the ones that have reported.
    const cachedYears = this.getCachedYears(grid, variable);
    const blockBytes = blocks.map((block) =>
      block.every((year) => cachedYears.has(year))
        ? null
        : { loaded: 0, total: 0 },
    );
    const emitProgress = () => {
      if (!onProgress) return;
      const pending = blockBytes.filter((bytes) => bytes !== null);
      const reported = pending.filter((bytes) => bytes.total > 0);
      if (reported.length === 0) return;
      const average =
        reported.reduce((sum, bytes) => sum + bytes.total, 0) / reported.length;
      let loaded = 0;
      let total = 0;
      for (const bytes of pending) {
        loaded += bytes.loaded;
        total += bytes.total > 0 ? bytes.total : average;
      }
      onProgress(loaded, Math.max(loaded, total));
    };

    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i]!;
      const bytes = blockBytes[i];
      const timeRange: AxisSlice = [
        yearToDateRange(block[0]!)[0],
        yearToDateRange(block[block.length - 1]!)[1],
      ];
      const res = await this.getTimeSeriesForRange(
        grid,
        timeRange,
        variable,
        bytes
          ? (loaded, total) => {
              bytes.loaded = loaded;
              bytes.total = total;
              emitProgress();
            }
          : undefined,
        signal,
        shared,
      );
      if (res.coveredDays !== undefined && coveredDays === undefined) {
        const slotsPerDay = this.dataset?.time.slotsPerDay ?? 24;
        coveredDays = totalLen / slotsPerDay + res.coveredDays;
      }
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
    return { values: merged, variable, units: resolvedUnits, coveredDays };
  }

  async getTimeSeries(
    grid: GridCell,
    variable = this.defaultVariable(),
    historyYears?: number,
    onProgress?: SeriesProgress,
    signal?: AbortSignal,
  ): Promise<{ values: Float32Array; variable: string; units?: string }> {
    const array = await this.getArray(variable);
    const timeRange = yearsToDayRange(
      historyYears ?? DEFAULT_HISTORY_YEARS,
      this.timeAxis(array).totalDays,
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

function budgetMessage(chunkCount: number, dayRange: AxisSlice): string {
  const days = dayRange[1] - dayRange[0];
  const perYear = Math.round((chunkCount / Math.max(1, days)) * 365);
  return `This store is chunked by map, not by time, so one point's series needs ${chunkCount.toLocaleString("en-US")} downloads for the selected years (about ${perYear.toLocaleString("en-US")} a year). EarthPrints makes at most ${MAX_CHUNKS_PER_SERIES} per load.`;
}

const ALL_FLUXCOM_YEARS = Array.from({ length: 2021 - 2001 + 1 }, (_, i) => 2001 + i);

function formatMB(bytes: number): string {
  return `${Math.round(bytes / 1024 ** 2).toLocaleString("en-US")} MB`;
}
