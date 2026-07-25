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
  type LocalOffset,
  type PixelNativeChunkContext,
} from "@/lib/zarr/chunks";
import {
  chunkIndexToStartDay,
  DEFAULT_HISTORY_YEARS,
  yearsToDayRange,
} from "@/lib/zarr/timeRange";
import {
  createByteProgressSink,
  fetchPixelTimeSeries,
  getActiveByteSink,
  setActiveByteSink,
  type ZarrArrayHandle,
  type ZarrStore,
} from "@/lib/zarr/store";
import { deriveGridSpec } from "@/lib/zarr/gridSpec";
import type { GridCell, GridSpec } from "@/types/map";

type CachedNativeChunk = {
  data: Float32Array;
  shape: readonly number[];
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
  private cache: LRUCache<string, CachedNativeChunk>;
  private arrayPromises = new Map<string, Promise<ZarrArray>>();
  private chunkLoadsInFlight = new Map<string, Promise<CachedNativeChunk>>();
  private prefetchInFlight = new Map<string, Promise<void>>();
  private gridSpecPromise?: Promise<GridSpec>;

  /** Default holds ~8 pixels of full history (6 native chunks per pixel). */
  constructor(ds: ZarrStore, maxCacheSize = 48) {
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

  private getChunkSizes(array: ZarrArray): ArrayChunkSizes {
    const [time, hour, lat, lon] = array.chunks;
    return { time, hour, lat, lon };
  }

  private nativeCoords(
    context: PixelNativeChunkContext,
    timeChunkIdx: number,
  ) {
    return {
      timeChunkIdx,
      hourChunkIdx: 0,
      latChunkIdx: context.chunkLatIdx,
      lonChunkIdx: context.chunkLonIdx,
    };
  }

  private hasAllNativeChunks(
    variable: string,
    context: PixelNativeChunkContext,
  ): boolean {
    return context.timeChunkIndices.every((timeChunkIdx) =>
      this.cache.has(
        nativeChunkKey(variable, this.nativeCoords(context, timeChunkIdx)),
      ),
    );
  }

  private loadNativeChunk(
    array: ZarrArray,
    variable: string,
    coords: {
      timeChunkIdx: number;
      hourChunkIdx: number;
      latChunkIdx: number;
      lonChunkIdx: number;
    },
  ): Promise<CachedNativeChunk> {
    const key = nativeChunkKey(variable, coords);
    const cached = this.cache.get(key);
    if (cached) return Promise.resolve(cached);

    const inFlight = this.chunkLoadsInFlight.get(key);
    if (inFlight) return inFlight;

    const promise = array
      .getChunk([
        coords.timeChunkIdx,
        coords.hourChunkIdx,
        coords.latChunkIdx,
        coords.lonChunkIdx,
      ])
      .then((chunk: { data: Float32Array; shape: number[] }) => {
        const entry: CachedNativeChunk = {
          data: chunk.data as Float32Array,
          shape: chunk.shape,
        };
        this.cache.set(key, entry);
        return entry;
      })
      .finally(() => {
        this.chunkLoadsInFlight.delete(key);
      });

    this.chunkLoadsInFlight.set(key, promise);
    return promise;
  }

  private buildFromNativeCache(
    variable: string,
    context: PixelNativeChunkContext,
    timeRange: AxisSlice,
    hourCount: number,
    chunkTime: number,
    units?: string,
  ): { values: Float32Array; variable: string; units?: string } {
    const localOffset: LocalOffset = {
      localLat: context.localLat,
      localLon: context.localLon,
    };

    const segments = context.timeChunkIndices.map((timeChunkIdx) => {
      const key = nativeChunkKey(
        variable,
        this.nativeCoords(context, timeChunkIdx),
      );
      const chunk = this.cache.get(key)!;
      return {
        values: extractPixelFromNativeChunk(
          chunk.data,
          chunk.shape,
          localOffset,
        ),
        chunkStartDay: chunkIndexToStartDay(timeChunkIdx, chunkTime),
      };
    });

    return {
      values: stitchTimeSeriesForRange(segments, timeRange, hourCount),
      variable,
      units,
    };
  }

  private prefetchNativeChunks(
    array: ZarrArray,
    variable: string,
    context: PixelNativeChunkContext,
  ): void {
    const prefetchKey = `${variable}:${context.chunkLatIdx}:${context.chunkLonIdx}`;
    if (this.prefetchInFlight.has(prefetchKey)) return;

    const missing = context.timeChunkIndices.filter(
      (timeChunkIdx) =>
        !this.cache.has(
          nativeChunkKey(variable, this.nativeCoords(context, timeChunkIdx)),
        ) && !this.chunkLoadsInFlight.has(
          nativeChunkKey(variable, this.nativeCoords(context, timeChunkIdx)),
        ),
    );
    if (missing.length === 0) return;

    const promise = Promise.all(
      missing.map((timeChunkIdx) =>
        this.loadNativeChunk(
          array,
          variable,
          this.nativeCoords(context, timeChunkIdx),
        ),
      ),
    )
      .then(() => undefined)
      .catch(() => {
        // Prefetch is best-effort; explicit requests retry failed chunks.
      })
      .finally(() => {
        this.prefetchInFlight.delete(prefetchKey);
      });

    this.prefetchInFlight.set(prefetchKey, promise);
  }

  async getTimeSeries(
    grid: GridCell,
    variable = ZARR_STORE.defaultVariable,
    historyYears?: number,
    onProgress?: SeriesProgress,
  ): Promise<{ values: Float32Array; variable: string; units?: string }> {
    const array = await this.getArray(variable);
    const chunkSizes = this.getChunkSizes(array);
    const [timeCount, hourCount] = array.shape;
    const timeRange = yearsToDayRange(historyYears ?? DEFAULT_HISTORY_YEARS, timeCount);
    const context = pixelToNativeChunkContext(
      grid.latIndex,
      grid.lonIndex,
      timeCount,
      chunkSizes,
      timeRange,
    );
    const units =
      typeof array.attrs.units === "string" ? array.attrs.units : undefined;

    if (this.hasAllNativeChunks(variable, context)) {
      onProgress?.(1, 1);
      return this.buildFromNativeCache(
        variable,
        context,
        timeRange,
        hourCount,
        chunkSizes.time,
        units,
      );
    }

    // Stream byte-level progress off the chunk requests this fetch triggers.
    // Prefetch runs after the sink is cleared, so it is not counted.
    const sink = onProgress ? createByteProgressSink(onProgress) : null;
    if (sink) setActiveByteSink(sink);
    try {
      return await fetchPixelTimeSeries(array, grid, variable, timeRange);
    } finally {
      // Only clear if a newer request has not already swapped in its own sink.
      if (sink && getActiveByteSink() === sink) setActiveByteSink(null);
      this.prefetchNativeChunks(array, variable, context);
    }
  }
}
