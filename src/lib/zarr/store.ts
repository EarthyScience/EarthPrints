import * as zarr from "zarrita";
import { ZARR_STORE } from "@/lib/constants/store";
import type { AxisSlice } from "@/lib/zarr/chunks";
import type { GridCell } from "@/types/map";

export type ZarrStore = Awaited<ReturnType<typeof openZarrStore>>;

export type ZarrArrayHandle = {
  attrs: Record<string, unknown>;
  shape: number[];
  chunks: number[];
};

export async function openZarrStore(url = ZARR_STORE.url) {
  const raw = new zarr.FetchStore(url);
  const consolidated = await zarr.withConsolidatedMetadata(raw);
  const store = zarr.withByteCaching(consolidated);
  return {
    store,
    root: zarr.root(store),
  };
}

/** One pixel, time × hour slice, via zarrita's built-in slice assembly. */
export async function fetchPixelTimeSeries(
  array: ZarrArrayHandle,
  grid: GridCell,
  variable: string = ZARR_STORE.defaultVariable,
  timeRange?: AxisSlice,
): Promise<{ values: Float32Array; variable: string; units?: string }> {
  const timeSelection =
    timeRange === undefined
      ? null
      : zarr.slice(timeRange[0], timeRange[1]);

  const result = await zarr.get(array as Parameters<typeof zarr.get>[0], [
    timeSelection,
    null,
    grid.latIndex,
    grid.lonIndex,
  ]);
  const units =
    typeof array.attrs.units === "string" ? array.attrs.units : undefined;

  return {
    values: result.data as Float32Array,
    variable,
    units,
  };
}
