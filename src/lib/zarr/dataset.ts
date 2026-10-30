import * as zarr from "zarrita";
import { decodeCfTimes } from "@/lib/zarr/cfTime";
import { openZarrStore, type ZarrStore } from "@/lib/zarr/store";
import { buildTimeAxis, type TimeAxis } from "@/lib/zarr/timeAxis";
import type { GridSpec } from "@/types/map";

/** A non-spatial, non-time axis the user picks one index of (ensemble, level). */
export type ExtraDim = {
  axis: number;
  name: string;
  size: number;
  /** Coordinate values as text, when the store has them. */
  labels: string[] | null;
  units: string | null;
};

/** Which array axis plays which role. `hour` is -1 when there is none. */
export type DatasetLayout = {
  rank: number;
  time: number;
  hour: number;
  lat: number;
  lon: number;
  extras: ExtraDim[];
};

/**
 * CF packing: `value = raw * scale + offset`, with `fill` and anything outside
 * `validMin`..`validMax` read as missing.
 */
export type DatasetDecode = {
  scale: number;
  offset: number;
  fill: number[];
  validMin?: number;
  validMax?: number;
};

export type VariableInfo = {
  path: string;
  longName: string | null;
  units: string | null;
  shape: number[];
};

export type Dataset = {
  /** Store root, normalised. */
  url: string;
  /** Array path inside the store, e.g. `NEE` or `atmos/tas`. */
  variable: string;
  /** The store's own title, or its last path segment. */
  title: string;
  longName: string | null;
  units: string | null;
  /** Every array in the store that can be read as a map of time series. */
  variables: VariableInfo[];
  layout: DatasetLayout;
  shape: number[];
  chunks: number[];
  bytesPerValue: number;
  decode: DatasetDecode;
  grid: GridSpec;
  time: TimeAxis;
};

/** Thrown with a message that can be shown to the user as is. */
export class DatasetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DatasetError";
  }
}

const LAT_NAMES = /^(lat|lats|latitude|nav_lat|grid_yt|rlat|y|lat_\d+)$/i;
const LON_NAMES = /^(lon|lons|long|longitude|nav_lon|grid_xt|rlon|x|lon_\d+)$/i;
const TIME_NAMES = /^(time|times|valid_time|t|date|time_counter|time\d*)$/i;
const HOUR_NAMES = /^(hour|hours|hour_of_day)$/i;

const BYTES: Record<string, number> = {
  int8: 1,
  uint8: 1,
  int16: 2,
  uint16: 2,
  float16: 2,
  int32: 4,
  uint32: 4,
  float32: 4,
  int64: 8,
  uint64: 8,
  float64: 8,
};

type OpenedArray = zarr.Array<zarr.DataType, zarr.Readable>;

/**
 * Accept what people paste: a store root, a link to its `zarr.json` or
 * `.zmetadata`, an `s3://` or `gs://` URI, or a Hugging Face "blob" link.
 */
export function normalizeStoreUrl(input: string): string {
  let url = input.trim();
  const s3 = url.match(/^s3:\/\/([^/]+)\/?(.*)$/i);
  if (s3) url = `https://${s3[1]}.s3.amazonaws.com/${s3[2]}`;
  const gs = url.match(/^gs:\/\/([^/]+)\/?(.*)$/i);
  if (gs) url = `https://storage.googleapis.com/${gs[1]}/${gs[2]}`;
  url = url.replace(/^(https:\/\/huggingface\.co\/.+?)\/blob\//, "$1/resolve/");
  url = url.replace(/[?#].*$/, "");
  url = url.replace(/\/(zarr\.json|\.zmetadata|\.zattrs|\.zgroup|\.zarray)$/i, "");
  return url.replace(/\/+$/, "");
}

function stringAttr(attrs: Record<string, unknown>, key: string): string | null {
  const value = attrs[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function numberAttr(attrs: Record<string, unknown>, key: string): number | null {
  const value = attrs[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (Array.isArray(value) && typeof value[0] === "number") return value[0];
  return null;
}

function parentPath(path: string): string {
  const index = path.lastIndexOf("/");
  return index <= 0 ? "" : path.slice(0, index);
}

function baseName(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}

async function openArray(ds: ZarrStore, path: string): Promise<OpenedArray> {
  return zarr.open(ds.root.resolve(path), { kind: "array" });
}

function dimensionNames(array: OpenedArray): string[] | null {
  const names = array.dimensionNames;
  if (Array.isArray(names) && names.length === array.shape.length) return names;
  return null;
}

/** Roles from dimension names, or from the shape alone when it is unambiguous. */
export function inferLayout(
  names: readonly string[] | null,
  shape: readonly number[],
): Omit<DatasetLayout, "extras"> & { extraAxes: number[] } | null {
  const rank = shape.length;
  if (rank < 3) return null;

  if (!names) {
    if (rank === 3) return { rank, time: 0, hour: -1, lat: 1, lon: 2, extraAxes: [] };
    if (rank === 4 && shape[1] === 24) {
      return { rank, time: 0, hour: 1, lat: 2, lon: 3, extraAxes: [] };
    }
    return null;
  }

  const find = (pattern: RegExp, taken: number[]) =>
    names.findIndex((name, axis) => !taken.includes(axis) && pattern.test(name));
  const lat = find(LAT_NAMES, []);
  const lon = find(LON_NAMES, [lat]);
  const time = find(TIME_NAMES, [lat, lon]);
  const hour = find(HOUR_NAMES, [lat, lon, time]);
  if (lat < 0 || lon < 0 || time < 0) return null;

  const roles = [lat, lon, time, hour];
  const extraAxes = names
    .map((_, axis) => axis)
    .filter((axis) => !roles.includes(axis));
  return { rank, time, hour, lat, lon, extraAxes };
}

function toNumbers(data: ArrayLike<unknown>): Float64Array {
  const out = new Float64Array(data.length);
  for (let i = 0; i < data.length; i++) out[i] = Number(data[i]);
  return out;
}

/** A 1-D coordinate next to the variable, or at the store root. */
async function readCoordinate(
  ds: ZarrStore,
  variablePath: string,
  name: string,
): Promise<{ values: Float64Array; attrs: Record<string, unknown> } | null> {
  const group = parentPath(variablePath);
  const candidates = [group ? `${group}/${name}` : name, name];
  for (const path of [...new Set(candidates)]) {
    let array: OpenedArray;
    try {
      array = await openArray(ds, path);
    } catch {
      continue;
    }
    if (array.shape.length !== 1) continue;
    try {
      const result = await zarr.get(array, null, {
        createQueue: () => limitedQueue(COORDINATE_FETCHES),
      });
      return {
        values: toNumbers(result.data as ArrayLike<unknown>),
        attrs: array.attrs as Record<string, unknown>,
      };
    } catch (cause) {
      throw new DatasetError(
        `The "${name}" coordinate could not be read: ${cause instanceof Error ? cause.message : String(cause)}`,
      );
    }
  }
  return null;
}

/**
 * Parallel chunk reads for one coordinate. Some stores split a time axis into
 * a thousand tiny chunks, and starting them all at once runs the browser out
 * of connections.
 */
const COORDINATE_FETCHES = 8;

function limitedQueue(limit: number) {
  const results: Promise<void>[] = [];
  const waiting: (() => void)[] = [];
  let running = 0;
  const next = () => {
    running--;
    waiting.shift()?.();
  };
  return {
    add(fn: () => Promise<void>) {
      results.push(
        new Promise<void>((resolve, reject) => {
          const start = () => {
            running++;
            fn().then(resolve, reject).finally(next);
          };
          if (running < limit) start();
          else waiting.push(start);
        }),
      );
    },
    onIdle: () => Promise.all(results),
  };
}

type Axis1D = { start: number; step: number; values: Float64Array | null };

/** Start and step of a 1-D axis, keeping the values when it is not regular. */
export function describeAxis(values: Float64Array): Axis1D {
  const n = values.length;
  const start = values[0]!;
  const step = n > 1 ? (values[n - 1]! - start) / (n - 1) : 1;
  let regular = true;
  for (let i = 0; i < n; i++) {
    if (Math.abs(values[i]! - (start + i * step)) > Math.abs(step) * 0.01) {
      regular = false;
      break;
    }
  }
  return { start, step, values: regular ? null : values };
}

function decodeFor(array: OpenedArray): DatasetDecode {
  const attrs = array.attrs as Record<string, unknown>;
  const fill = new Set<number>();
  const add = (value: unknown) => {
    const number = typeof value === "bigint" ? Number(value) : value;
    if (typeof number === "number" && Number.isFinite(number)) fill.add(number);
  };
  add(array.fillValue);
  add(attrs._FillValue);
  const missing = attrs.missing_value;
  if (Array.isArray(missing)) missing.forEach(add);
  else add(missing);

  const range = Array.isArray(attrs.valid_range) ? attrs.valid_range : null;
  const validMin =
    numberAttr(attrs, "valid_min") ?? (typeof range?.[0] === "number" ? range[0] : null);
  const validMax =
    numberAttr(attrs, "valid_max") ?? (typeof range?.[1] === "number" ? range[1] : null);

  return {
    scale: numberAttr(attrs, "scale_factor") ?? 1,
    offset: numberAttr(attrs, "add_offset") ?? 0,
    fill: [...fill],
    ...(validMin !== null && { validMin }),
    ...(validMax !== null && { validMax }),
  };
}

async function readExtraDim(
  ds: ZarrStore,
  variable: string,
  axis: number,
  name: string,
  size: number,
): Promise<ExtraDim> {
  const coordinate = size <= 5000 ? await readCoordinate(ds, variable, name) : null;
  const labels =
    coordinate && coordinate.values.length === size
      ? Array.from(coordinate.values, (v) =>
          Number.isFinite(v) ? String(Number(v.toPrecision(6))) : "?",
        )
      : null;
  return {
    axis,
    name,
    size,
    labels,
    units: coordinate ? stringAttr(coordinate.attrs, "units") : null,
  };
}

/** Arrays that look like a time series on a lat/lon grid. */
async function listVariables(ds: ZarrStore): Promise<VariableInfo[]> {
  const listable = ds.store as { contents?: () => { path: string; kind: string }[] };
  if (typeof listable.contents !== "function") return [];

  const paths = listable
    .contents()
    .filter((entry) => entry.kind === "array")
    .map((entry) => entry.path.replace(/^\//, ""));

  const found: VariableInfo[] = [];
  for (const path of paths) {
    try {
      const array = await openArray(ds, path);
      if (!inferLayout(dimensionNames(array), array.shape)) continue;
      if (!(array.dtype in BYTES)) continue;
      const attrs = array.attrs as Record<string, unknown>;
      found.push({
        path,
        longName: stringAttr(attrs, "long_name") ?? stringAttr(attrs, "standard_name"),
        units: stringAttr(attrs, "units"),
        shape: array.shape,
      });
    } catch {
      // Unreadable metadata for one array should not hide the others.
    }
  }
  return found;
}

/** Prefer arrays with more cells, then the first listed. */
function defaultVariable(variables: VariableInfo[]): string | null {
  if (variables.length === 0) return null;
  const size = (v: VariableInfo) => v.shape.reduce((a, b) => a * b, 1);
  return [...variables].sort((a, b) => size(b) - size(a))[0]!.path;
}

function validLatitudes(values: Float64Array): boolean {
  return values.every((v) => Number.isFinite(v) && v >= -90.5 && v <= 90.5);
}

function validLongitudes(values: Float64Array): boolean {
  return values.every((v) => Number.isFinite(v) && v >= -360 && v <= 720);
}

async function describeVariable(
  ds: ZarrStore,
  variable: string,
  variables: VariableInfo[],
): Promise<Omit<Dataset, "url" | "title">> {
  let array: OpenedArray;
  try {
    array = await openArray(ds, variable);
  } catch {
    throw new DatasetError(`There is no array called "${variable}" in this store.`);
  }

  if (!(array.dtype in BYTES)) {
    throw new DatasetError(
      `"${variable}" holds ${array.dtype} values. Only numeric arrays can be plotted.`,
    );
  }

  const names = dimensionNames(array);
  const inferred = inferLayout(names, array.shape);
  if (!inferred) {
    throw new DatasetError(
      names
        ? `"${variable}" has the dimensions ${names.join(", ")}. EarthPrints needs a time, a latitude and a longitude dimension.`
        : `"${variable}" has no dimension names, so its time, latitude and longitude axes cannot be told apart.`,
    );
  }

  const dimName = (axis: number, fallback: string) => names?.[axis] ?? fallback;
  const [latCoord, lonCoord, timeCoord] = await Promise.all([
    readCoordinate(ds, variable, dimName(inferred.lat, "lat")),
    readCoordinate(ds, variable, dimName(inferred.lon, "lon")),
    readCoordinate(ds, variable, dimName(inferred.time, "time")),
  ]);

  if (!latCoord || !lonCoord) {
    throw new DatasetError(
      `"${variable}" has no 1-D latitude and longitude coordinates. Curvilinear and projected grids are not supported yet.`,
    );
  }
  if (!validLatitudes(latCoord.values) || !validLongitudes(lonCoord.values)) {
    throw new DatasetError(
      `The ${dimName(inferred.lat, "lat")} and ${dimName(inferred.lon, "lon")} coordinates are not in degrees. Projected grids are not supported yet.`,
    );
  }
  if (!timeCoord) {
    throw new DatasetError(`"${variable}" has no time coordinate to read dates from.`);
  }

  const times = decodeCfTimes(
    timeCoord.values,
    timeCoord.attrs.units,
    timeCoord.attrs.calendar,
  );
  if (!times) {
    const units = stringAttr(timeCoord.attrs, "units");
    throw new DatasetError(
      units
        ? `The time units "${units}" (calendar ${String(timeCoord.attrs.calendar ?? "standard")}) cannot be read.`
        : "The time coordinate has no units, so its dates cannot be read.",
    );
  }

  const hourCount = inferred.hour >= 0 ? array.shape[inferred.hour]! : null;
  const time = buildTimeAxis(times, hourCount);

  const extras = await Promise.all(
    inferred.extraAxes.map((axis) =>
      readExtraDim(ds, variable, axis, dimName(axis, `dim_${axis}`), array.shape[axis]!),
    ),
  );

  const lat = describeAxis(latCoord.values);
  const lon = describeAxis(lonCoord.values);
  const attrs = array.attrs as Record<string, unknown>;

  const grid: GridSpec = {
    grid: {
      lonStart: lon.start,
      lonStep: lon.step,
      latStart: lat.start,
      latStep: lat.step,
    },
    dimensions: {
      time: time.totalDays,
      hour: time.slotsPerDay,
      lat: array.shape[inferred.lat]!,
      lon: array.shape[inferred.lon]!,
    },
    nativeChunks: {
      lat: array.chunks[inferred.lat]!,
      lon: array.chunks[inferred.lon]!,
    },
    spatialResolutionDeg: Math.abs(lon.step),
    latValues: lat.values ?? undefined,
    lonValues: lon.values ?? undefined,
  };

  return {
    variable,
    longName: stringAttr(attrs, "long_name") ?? stringAttr(attrs, "standard_name"),
    units: stringAttr(attrs, "units"),
    variables,
    layout: {
      rank: inferred.rank,
      time: inferred.time,
      hour: inferred.hour,
      lat: inferred.lat,
      lon: inferred.lon,
      extras,
    },
    shape: array.shape,
    chunks: array.chunks,
    bytesPerValue: BYTES[array.dtype]!,
    decode: decodeFor(array),
    grid,
    time,
  };
}

export type OpenDatasetResult = { dataset: Dataset; store: ZarrStore };

/**
 * Open a store and describe one of its variables. Without `variable`, the
 * largest array that reads as a map of time series is picked.
 */
export async function openDataset(
  input: string,
  variable?: string | null,
): Promise<OpenDatasetResult> {
  let url = normalizeStoreUrl(input);
  if (!/^https?:\/\//i.test(url)) {
    throw new DatasetError("Enter an http(s), s3:// or gs:// address.");
  }

  let ds: ZarrStore;
  try {
    ds = await openZarrStore(url);
  } catch (cause) {
    throw new DatasetError(storeErrorMessage(cause));
  }

  let target = variable?.trim().replace(/^\/+|\/+$/g, "") || null;

  // A link straight to an array: open its parent and pick the array.
  try {
    const node = await zarr.open(ds.root);
    if (node.kind === "array") {
      const parent = url.slice(0, url.lastIndexOf("/"));
      target = target ?? baseName(url);
      url = parent;
      ds = await openZarrStore(parent);
    }
  } catch (cause) {
    if (!target) throw new DatasetError(storeErrorMessage(cause));
  }

  const variables = await listVariables(ds);
  target = target ?? defaultVariable(variables);
  if (!target) {
    throw new DatasetError(
      variables.length === 0 && typeof (ds.store as { contents?: unknown }).contents !== "function"
        ? "This store does not list its arrays. Type the variable's name, for example t2m."
        : "No array in this store has time, latitude and longitude dimensions. EarthPrints reads regular latitude and longitude grids; projected, curvilinear and unstructured grids are not supported yet.",
    );
  }

  const described = await describeVariable(ds, target, variables);
  const rootAttrs = await zarr
    .open(ds.root, { kind: "group" })
    .then((group) => group.attrs as Record<string, unknown>)
    .catch(() => ({}) as Record<string, unknown>);

  return {
    store: ds,
    dataset: {
      ...described,
      url,
      title: storeTitle(rootAttrs, url),
    },
  };
}

/**
 * The store's own title or name, else the CMIP facets ("CESM2 · piControl ·
 * r1i1p1f1"), else the last part of the address that is not a version tag.
 */
function storeTitle(attrs: Record<string, unknown>, url: string): string {
  const title =
    stringAttr(attrs, "title") ?? stringAttr(attrs, "name") ?? stringAttr(attrs, "dataset_id");
  if (title) return title;
  const facets = ["source_id", "experiment_id", "variant_label"]
    .map((key) => stringAttr(attrs, key))
    .filter((value): value is string => Boolean(value));
  if (facets.length >= 2) return facets.join(" · ");
  const parts = url.split("/").filter(Boolean);
  const named = parts.reverse().find((part) => !/^v\d{6,}$/.test(part)) ?? url;
  return named.replace(/\.zarr$/i, "");
}

function storeErrorMessage(cause: unknown): string {
  const message = cause instanceof Error ? cause.message : String(cause);
  if (/failed to fetch|networkerror|load failed|cors/i.test(message)) {
    return "The store could not be reached. It may be offline, or its server may not allow requests from other websites (CORS).";
  }
  if (/not ?found|404/i.test(message)) {
    return "No Zarr metadata was found at this address. Check that it points at the store's root.";
  }
  const refused = /\b(401|403|409)\b/.exec(message);
  if (refused) {
    return `The server refused access (HTTP ${refused[1]}). The store is probably private or requester-pays, which a browser cannot open.`;
  }
  if (/json|unexpected token|syntax/i.test(message)) {
    return "This address answered with something other than Zarr metadata. Check that it points at a Zarr store.";
  }
  return `The store could not be opened: ${message}`;
}
