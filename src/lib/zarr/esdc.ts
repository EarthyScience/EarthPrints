import * as zarr from "zarrita";
import { ESDC_TEST_DATASET } from "@/lib/constants/esdc";
import type { GridCell } from "@/types/map";

export type EsdcStore = Awaited<ReturnType<typeof openEsdcStore>>;

export async function openEsdcStore(url = ESDC_TEST_DATASET.url) {
  const raw = new zarr.FetchStore(url);
  const store = await zarr.withConsolidatedMetadata(raw);
  return {
    store,
    root: zarr.root(store),
  };
}

export async function fetchEsdcTimeSeries(
  esdc: EsdcStore,
  grid: GridCell,
  variable = ESDC_TEST_DATASET.defaultVariable,
): Promise<{ values: Float32Array; variable: string; units?: string }> {
  const array = await zarr.open(esdc.root.resolve(variable), { kind: "array" });
  const result = await zarr.get(array, [null, grid.latIndex, grid.lonIndex]);
  const units =
    typeof array.attrs.units === "string" ? array.attrs.units : undefined;

  return {
    values: result.data as Float32Array,
    variable,
    units,
  };
}
