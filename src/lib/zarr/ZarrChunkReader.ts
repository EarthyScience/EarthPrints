import * as zarr from "zarrita";
import { LRUCache } from "@/lib/cache/lru";
import { ZARR_STORE } from "@/lib/constants/store";
import {
  extractTimeSeries,
  pixelToChunkKey,
  pixelToLocalOffset,
} from "@/lib/zarr/chunks";
import { fetchChunk, type ZarrStore } from "@/lib/zarr/store";
import type { GridCell } from "@/types/map";

type CachedChunk = {
  data: Float32Array;
  shape: readonly number[];
  units?: string;
};

type SpatialChunkSizes = {
  chunkLat: number;
  chunkLon: number;
};

export class ZarrChunkReader {
  private ds: ZarrStore;
  private cache: LRUCache<string, CachedChunk>;
  private spatialChunksByVariable = new Map<string, SpatialChunkSizes>();

  constructor(ds: ZarrStore, maxCacheSize = 16) {
    this.ds = ds;
    this.cache = new LRUCache(maxCacheSize);
  }

  private async getSpatialChunkSizes(
    variable: string,
  ): Promise<SpatialChunkSizes> {
    const cached = this.spatialChunksByVariable.get(variable);
    if (cached) return cached;

    const array = await zarr.open(this.ds.root.resolve(variable), {
      kind: "array",
    });
    const sizes: SpatialChunkSizes = {
      chunkLat: array.chunks[2],
      chunkLon: array.chunks[3],
    };
    this.spatialChunksByVariable.set(variable, sizes);
    return sizes;
  }

  async getTimeSeries(
    grid: GridCell,
    variable = ZARR_STORE.defaultVariable,
  ): Promise<{ values: Float32Array; variable: string; units?: string }> {
    const { chunkLat, chunkLon } = await this.getSpatialChunkSizes(variable);

    const chunkKey = pixelToChunkKey(
      variable,
      grid.latIndex,
      grid.lonIndex,
      chunkLat,
      chunkLon,
    );
    const localOffset = pixelToLocalOffset(
      grid.latIndex,
      grid.lonIndex,
      chunkLat,
      chunkLon,
    );

    let cached = this.cache.get(chunkKey);
    if (!cached) {
      const chunk = await fetchChunk(
        this.ds,
        grid.latIndex,
        grid.lonIndex,
        variable,
      );
      cached = {
        data: chunk.data,
        shape: chunk.shape,
        units: chunk.units,
      };
      this.cache.set(chunkKey, cached);
    }

    const values = extractTimeSeries(
      cached.data,
      cached.shape,
      localOffset,
    );

    return { values, variable, units: cached.units };
  }
}
