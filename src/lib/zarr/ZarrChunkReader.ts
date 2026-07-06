import * as zarr from "zarrita";
import { LRUCache } from "@/lib/cache/lru";
import { ZARR_STORE } from "@/lib/constants/store";
import {
  extractPixelFromNativeChunk,
  nativeChunkKey,
  pixelToNativeChunkContext,
  stitchTimeSeries,
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
  fetchPixelTimeSeries,
  type ZarrArrayHandle,
  type ZarrStore,
} from "@/lib/zarr/store";
import type { GridCell } from "@/types/map";

type CachedNativeChunk = {
  data: Float32Array;
  shape: readonly number[];
};

/** Reports download progress as `completed` of `total` time-chunks. */
export type SeriesProgress = (completed: number, total: number) => void;

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

  /** Default holds ~8 pixels of full history (6 native chunks per pixel). */
  constructor(ds: ZarrStore, maxCacheSize = 48) {
    this.ds = ds;
    this.cache = new LRUCache(maxCacheSize);
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
    const total = context.timeChunkIndices.length;

    if (this.hasAllNativeChunks(variable, context)) {
      onProgress?.(total, total);
      return this.buildFromNativeCache(
        variable,
        context,
        timeRange,
        hourCount,
        chunkSizes.time,
        units,
      );
    }

    const pixel = await this.fetchPixelSeriesByTimeChunk(
      array,
      grid,
      variable,
      timeRange,
      chunkSizes.time,
      context.timeChunkIndices,
      units,
      onProgress,
    );
    this.prefetchNativeChunks(array, variable, context);
    return pixel;
  }

  /**
   * Fetch the pixel's series one time-chunk at a time so we can report real
   * download progress. Each request pulls the same bytes a single slice would;
   * the segments are stitched back in chunk order, so the result is identical.
   */
  private async fetchPixelSeriesByTimeChunk(
    array: ZarrArray,
    grid: GridCell,
    variable: string,
    timeRange: AxisSlice,
    chunkTime: number,
    timeChunkIndices: number[],
    units: string | undefined,
    onProgress?: SeriesProgress,
  ): Promise<{ values: Float32Array; variable: string; units?: string }> {
    const total = timeChunkIndices.length;
    if (total === 0) {
      onProgress?.(0, 0);
      return { values: new Float32Array(0), variable, units };
    }

    const [rangeStart, rangeStop] = timeRange;
    const segments = new Array<Float32Array>(total);
    let completed = 0;
    onProgress?.(0, total);

    await Promise.all(
      timeChunkIndices.map(async (timeChunkIdx, position) => {
        const chunkStart = timeChunkIdx * chunkTime;
        const subRange: AxisSlice = [
          Math.max(rangeStart, chunkStart),
          Math.min(rangeStop, chunkStart + chunkTime),
        ];
        const part = await fetchPixelTimeSeries(array, grid, variable, subRange);
        segments[position] = part.values;
        completed += 1;
        onProgress?.(completed, total);
      }),
    );

    return { values: stitchTimeSeries(segments), variable, units };
  }
}
