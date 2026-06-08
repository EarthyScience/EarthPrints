import * as zarr from "zarrita";
import { ZARR_STORE } from "@/lib/constants/store";
import type { GridCell } from "@/types/map";

export type ZarrStore = Awaited<ReturnType<typeof openZarrStore>>;

export async function openZarrStore(url = ZARR_STORE.url) {
  const raw = new zarr.FetchStore(url);
  const store = await zarr.withConsolidatedMetadata(raw);
  return {
    store,
    root: zarr.root(store),
  };
}

export async function fetchZarrTimeSeries(
  ds: ZarrStore,
  grid: GridCell,
  variable = ZARR_STORE.defaultVariable,
): Promise<{ values: Float32Array; variable: string; units?: string }> {
  const array = await zarr.open(ds.root.resolve(variable), { kind: "array" });
  const result = await zarr.get(array, [null, null, grid.latIndex, grid.lonIndex]); /* days, hours, lat, lon */
  const units =
    typeof array.attrs.units === "string" ? array.attrs.units : undefined;

  return {
    values: result.data as Float32Array,
    variable,
    units,
  };
}
