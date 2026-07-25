import * as zarr from "zarrita";
import { DEFAULT_GRID_SPEC, ZARR_STORE } from "@/lib/constants/store";
import type { GridSpec } from "@/types/map";
import type { ZarrStore } from "@/lib/zarr/store";

/** Axis names we recognize, in the order the data variable is expected to use. */
const FALLBACK_DIM_ORDER = ["time", "hour", "lat", "lon"] as const;

type OpenedArray = {
  shape: number[];
  chunks: number[];
  attrs: Record<string, unknown>;
};

async function openArray(store: ZarrStore, name: string): Promise<OpenedArray> {
  const array = await zarr.open(store.root.resolve(name), { kind: "array" });
  return array as unknown as OpenedArray;
}

/** Dimension names of a variable, from `_ARRAY_DIMENSIONS`, if present. */
function arrayDimensions(attrs: Record<string, unknown>): string[] | null {
  const dims = attrs["_ARRAY_DIMENSIONS"];
  if (Array.isArray(dims) && dims.every((d) => typeof d === "string")) {
    return dims as string[];
  }
  return null;
}

/** First two cell centers of a 1-D coordinate array → start and step. */
async function readAxisStartStep(
  store: ZarrStore,
  name: string,
): Promise<{ start: number; step: number }> {
  const array = await openArray(store, name);
  const head = await zarr.get(array as Parameters<typeof zarr.get>[0], [
    zarr.slice(0, 2),
  ]);
  const data = head.data as { [index: number]: number; length: number };
  const start = Number(data[0]);
  const step = Number(data[1]) - Number(data[0]);
  return { start, step };
}

/**
 * Read the dataset's spatial grid from the remote store's metadata instead of
 * trusting the hardcoded constants. Opens the data variable for its shape,
 * chunks and dimension order, then reads the first two entries of the `lon`
 * and `lat` coordinate arrays to recover each axis start and step.
 *
 * Any failure (missing array, unexpected layout, network error) falls back to
 * `DEFAULT_GRID_SPEC` so the map keeps working against the known store.
 */
export async function deriveGridSpec(
  store: ZarrStore,
  variable: string = ZARR_STORE.defaultVariable,
): Promise<GridSpec> {
  try {
    const data = await openArray(store, variable);
    const dims = arrayDimensions(data.attrs) ?? [...FALLBACK_DIM_ORDER];

    const fallbackOrder: readonly string[] = FALLBACK_DIM_ORDER;
    const axisIndex = (name: string) => {
      const idx = dims.indexOf(name);
      return idx === -1 ? fallbackOrder.indexOf(name) : idx;
    };

    const timeAxis = axisIndex("time");
    const hourAxis = axisIndex("hour");
    const latAxis = axisIndex("lat");
    const lonAxis = axisIndex("lon");

    if (latAxis < 0 || lonAxis < 0) return DEFAULT_GRID_SPEC;

    const [lon, lat] = await Promise.all([
      readAxisStartStep(store, dims[lonAxis] ?? "lon"),
      readAxisStartStep(store, dims[latAxis] ?? "lat"),
    ]);

    const dimensionSize = (axis: number, fallback: number) =>
      Number.isInteger(data.shape[axis]) ? data.shape[axis] : fallback;

    return {
      grid: {
        lonStart: lon.start,
        lonStep: lon.step,
        latStart: lat.start,
        latStep: lat.step,
      },
      dimensions: {
        time: dimensionSize(timeAxis, DEFAULT_GRID_SPEC.dimensions.time),
        hour: dimensionSize(hourAxis, DEFAULT_GRID_SPEC.dimensions.hour),
        lat: data.shape[latAxis],
        lon: data.shape[lonAxis],
      },
      nativeChunks: {
        lat: data.chunks[latAxis] ?? DEFAULT_GRID_SPEC.nativeChunks.lat,
        lon: data.chunks[lonAxis] ?? DEFAULT_GRID_SPEC.nativeChunks.lon,
      },
      spatialResolutionDeg: Math.abs(lon.step),
    };
  } catch {
    return DEFAULT_GRID_SPEC;
  }
}
