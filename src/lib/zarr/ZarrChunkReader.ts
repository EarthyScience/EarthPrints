import * as zarr from "zarrita";
import { LRUCache } from "@/lib/cache/lru";
import { ZARR_STORE } from "@/lib/constants/store";
import {
  extractPixelFromNativeChunk,
  nativeChunkKey,
  pixelToNativeChunkContext,
  stitchTimeSeries,
  type ArrayChunkSizes,
  type LocalOffset,
  type PixelNativeChunkContext,
} from "@/lib/zarr/chunks";
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
      .catch((error: unknown) => {
        this.chunkLoadsInFlight.delete(key);
        throw error;
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
      return extractPixelFromNativeChunk(
        chunk.data,
        chunk.shape,
        localOffset,
      );
    });

    return {
      values: stitchTimeSeries(segments),
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
      .finally(() => {
        this.prefetchInFlight.delete(prefetchKey);
      });

    this.prefetchInFlight.set(prefetchKey, promise);
  }

  async getTimeSeries(
    grid: GridCell,
    variable = ZARR_STORE.defaultVariable,
  ): Promise<{ values: Float32Array; variable: string; units?: string }> {
    const array = await this.getArray(variable);
    const chunkSizes = this.getChunkSizes(array);
    const [timeCount] = array.shape;
    const context = pixelToNativeChunkContext(
      grid.latIndex,
      grid.lonIndex,
      timeCount,
      chunkSizes,
    );
    const units =
      typeof array.attrs.units === "string" ? array.attrs.units : undefined;

    if (this.hasAllNativeChunks(variable, context)) {
      return this.buildFromNativeCache(variable, context, units);
    }

    const pixel = await fetchPixelTimeSeries(array, grid, variable);
    this.prefetchNativeChunks(array, variable, context);
    return pixel;
  }
}
