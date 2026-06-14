import * as zarr from "zarrita";
import { ZARR_STORE } from "@/lib/constants/store";
import {
  pixelToChunkIndices,
  pixelToChunkKey,
  pixelToLocalOffset,
  spatialChunkToSlices,
  type LocalOffset,
} from "@/lib/zarr/chunks";

export { extractTimeSeries } from "@/lib/zarr/chunks";

export type ZarrStore = Awaited<ReturnType<typeof openZarrStore>>;

export async function openZarrStore(url = ZARR_STORE.url) {
  const raw = new zarr.FetchStore(url);
  const store = await zarr.withConsolidatedMetadata(raw);
  return {
    store,
    root: zarr.root(store),
  };
}

export type FetchedSpatialChunk = {
  data: Float32Array;
  shape: readonly number[];
  chunkKey: string;
  localOffset: LocalOffset;
  variable: string;
  units?: string;
};

/** Download the full spatial Zarr chunk that contains `(latIndex, lonIndex)`. */
export async function fetchChunk(
  ds: ZarrStore,
  latIndex: number,
  lonIndex: number,
  variable = ZARR_STORE.defaultVariable,
): Promise<FetchedSpatialChunk> {
  const array = await zarr.open(ds.root.resolve(variable), { kind: "array" });
  const [, , latCount, lonCount] = array.shape;
  const chunkLat = array.chunks[2];
  const chunkLon = array.chunks[3];

  const { chunkLatIdx, chunkLonIdx } = pixelToChunkIndices(
    latIndex,
    lonIndex,
    chunkLat,
    chunkLon,
  );

  const { latSlice, lonSlice } = spatialChunkToSlices(
    chunkLatIdx,
    chunkLonIdx,
    chunkLat,
    chunkLon,
    latCount,
    lonCount,
  );

  const result = await zarr.get(array, [
    null,
    null,
    zarr.slice(...latSlice),
    zarr.slice(...lonSlice),
  ]);

  const units =
    typeof array.attrs.units === "string" ? array.attrs.units : undefined;

  return {
    data: result.data as Float32Array,
    shape: result.shape,
    chunkKey: pixelToChunkKey(
      variable,
      latIndex,
      lonIndex,
      chunkLat,
      chunkLon,
    ),
    localOffset: pixelToLocalOffset(latIndex, lonIndex, chunkLat, chunkLon),
    variable,
    units,
  };
}
