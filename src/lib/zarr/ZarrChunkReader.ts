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
import { fetchPixelTimeSeries, type ZarrStore } from "@/lib/zarr/store";
import type { GridCell } from "@/types/map";

type CachedNativeChunk = {
  data: Float32Array;
  shape: readonly number[];
};

type ZarrArray = {
  shape: number[];
  chunks: number[];
  attrs: Record<string, unknown>;
  getChunk(
    chunkCoords: number[],
  ): Promise<{ data: Float32Array; shape: number[] }>;
};

export class ZarrChunkReader {
  private ds: ZarrStore;
  private cache: LRUCache<string, CachedNativeChunk>;
  private arraysByVariable = new Map<string, ZarrArray>();
  private prefetchInFlight = new Map<string, Promise<void>>();

  /** Default holds ~8 pixels of full history (6 native chunks per pixel). */
  constructor(ds: ZarrStore, maxCacheSize = 48) {
    this.ds = ds;
    this.cache = new LRUCache(maxCacheSize);
  }

  private async getArray(variable: string): Promise<ZarrArray> {
    const cached = this.arraysByVariable.get(variable);
    if (cached) return cached;

    const array = (await zarr.open(this.ds.root.resolve(variable), {
      kind: "array",
    })) as ZarrArray;
    this.arraysByVariable.set(variable, array);
    return array;
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

  private async loadNativeChunk(
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
    if (cached) return cached;

    const chunk = await array.getChunk([
      coords.timeChunkIdx,
      coords.hourChunkIdx,
      coords.latChunkIdx,
      coords.lonChunkIdx,
    ]);

    const entry: CachedNativeChunk = {
      data: chunk.data as Float32Array,
      shape: chunk.shape,
    };
    this.cache.set(key, entry);
    return entry;
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
        ),
    );
    if (missing.length === 0) return;

    const promise = Promise.all(
      missing.map((timeChunkIdx) =>
        this.loadNativeChunk(array, variable, this.nativeCoords(context, timeChunkIdx)),
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

    const pixel = await fetchPixelTimeSeries(this.ds, grid, variable);
    this.prefetchNativeChunks(array, variable, context);
    return pixel;
  }
}
