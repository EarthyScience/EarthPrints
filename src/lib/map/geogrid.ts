import { DEFAULT_GRID_SPEC } from "@/lib/constants/store";
import type { GeoPoint, GridCell, GridSpec } from "@/types/map";

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function nearestIndex(values: Float64Array, value: number): number {
  const n = values.length;
  const ascending = values[n - 1]! >= values[0]!;
  let lo = 0;
  let hi = n - 1;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    const before = ascending ? values[mid]! < value : values[mid]! > value;
    if (before) lo = mid + 1;
    else hi = mid;
  }
  if (lo > 0 && Math.abs(values[lo - 1]! - value) <= Math.abs(values[lo]! - value)) {
    return lo - 1;
  }
  return lo;
}

function snapToAxis(
  value: number,
  start: number,
  step: number,
  count: number,
  values?: Float64Array,
): { index: number; coordinate: number } {
  if (values && values.length === count) {
    const index = nearestIndex(values, value);
    return { index, coordinate: values[index]! };
  }
  const index = clamp(Math.round((value - start) / step), 0, count - 1);
  return {
    index,
    coordinate: start + index * step,
  };
}

/** Centre of cell `index` along one axis of the store. */
export function axisCoordinate(
  spec: GridSpec,
  axis: "lat" | "lon",
  index: number,
): number {
  const values = axis === "lat" ? spec.latValues : spec.lonValues;
  if (values?.[index] !== undefined) return values[index]!;
  const start = axis === "lat" ? spec.grid.latStart : spec.grid.lonStart;
  const step = axis === "lat" ? spec.grid.latStep : spec.grid.lonStep;
  return start + index * step;
}

/** The store's lon range, edge to edge, in its own convention (-180..180 or 0..360). */
function lonExtent(spec: GridSpec): { west: number; east: number } {
  const first = axisCoordinate(spec, "lon", 0);
  const last = axisCoordinate(spec, "lon", spec.dimensions.lon - 1);
  const half = Math.abs(spec.grid.lonStep) / 2;
  return { west: Math.min(first, last) - half, east: Math.max(first, last) + half };
}

/**
 * The copy of `lon` (shifted by whole turns) that lands inside the store's
 * range, or nearest to it: a 0..360 store is clicked in -180..180.
 */
function lonInStoreRange(lon: number, spec: GridSpec): number {
  const { west, east } = lonExtent(spec);
  if (east - west >= 359.999) return west + ((((lon - west) % 360) + 360) % 360);
  const centre = (west + east) / 2;
  return lon + 360 * Math.round((centre - lon) / 360);
}

/** Whether a point falls on the store's grid at all (regional stores). */
export function isPointInGrid(point: GeoPoint, spec: GridSpec): boolean {
  const { west, east } = lonExtent(spec);
  const lon = lonInStoreRange(point.lon, spec);
  const firstLat = axisCoordinate(spec, "lat", 0);
  const lastLat = axisCoordinate(spec, "lat", spec.dimensions.lat - 1);
  const step = Math.abs(spec.grid.latStep);
  // The outermost row of a global grid stands for the cap up to the pole,
  // which a Gaussian grid's uneven rows stop short of by up to a step.
  const reachesPole = (edge: number) => 90 - Math.abs(edge) < step * 1.5;
  const southRow = Math.min(firstLat, lastLat);
  const northRow = Math.max(firstLat, lastLat);
  const south = reachesPole(southRow) && southRow < 0 ? -90 : southRow - step / 2;
  const north = reachesPole(northRow) && northRow > 0 ? 90 : northRow + step / 2;
  return lon >= west && lon <= east && point.lat >= south && point.lat <= north;
}

/**
 * Snap a WGS-84 point to the nearest Zarr grid cell center. The cell's `lon`
 * stays on the clicked side of the antimeridian, whatever the store's own
 * longitude convention, so the map draws it under the pointer.
 */
export function geoPointToZarrGrid(
  point: GeoPoint,
  spec: GridSpec = DEFAULT_GRID_SPEC,
): GridCell {
  const { grid, dimensions } = spec;
  const storeLon = lonInStoreRange(point.lon, spec);
  const lon = snapToAxis(storeLon, grid.lonStart, grid.lonStep, dimensions.lon, spec.lonValues);
  const lat = snapToAxis(point.lat, grid.latStart, grid.latStep, dimensions.lat, spec.latValues);

  return {
    lon: lon.coordinate - (storeLon - point.lon),
    lat: lat.coordinate,
    lonIndex: lon.index,
    latIndex: lat.index,
  };
}

export type GridCellBounds = {
  west: number;
  east: number;
  south: number;
  north: number;
};

/** Half-open cell edges around a snapped cell center. */
export function gridCellToBounds(
  cell: GridCell,
  spec: GridSpec = DEFAULT_GRID_SPEC,
): GridCellBounds {
  const { grid } = spec;
  const halfLon = Math.abs(grid.lonStep) / 2;
  const halfLat = Math.abs(grid.latStep) / 2;

  return {
    west: cell.lon - halfLon,
    east: cell.lon + halfLon,
    south: cell.lat - halfLat,
    north: cell.lat + halfLat,
  };
}

/** Closed lon/lat ring for the given bounds (counter-clockwise). */
export function boundsToPolygon(bounds: GridCellBounds): GeoPoint[] {
  const { west, east, south, north } = bounds;

  return [
    { lon: west, lat: north },
    { lon: east, lat: north },
    { lon: east, lat: south },
    { lon: west, lat: south },
  ];
}

/** Closed lon/lat ring for the cell footprint (counter-clockwise). */
export function gridCellToPolygon(
  cell: GridCell,
  spec: GridSpec = DEFAULT_GRID_SPEC,
): GeoPoint[] {
  return boundsToPolygon(gridCellToBounds(cell, spec));
}

/**
 * Geographic bounds of the on-disk chunk (patch) that contains a cell. A
 * click downloads this whole patch, so this is what the "downloaded extent"
 * box outlines.
 */
export function chunkPatchBounds(
  cell: GridCell,
  chunkLat: number,
  chunkLon: number,
  spec: GridSpec = DEFAULT_GRID_SPEC,
): GridCellBounds {
  const { grid, dimensions } = spec;
  const firstLatIdx = Math.floor(cell.latIndex / chunkLat) * chunkLat;
  const lastLatIdx = Math.min(firstLatIdx + chunkLat, dimensions.lat) - 1;
  const firstLonIdx = Math.floor(cell.lonIndex / chunkLon) * chunkLon;
  const lastLonIdx = Math.min(firstLonIdx + chunkLon, dimensions.lon) - 1;

  // The cell's lon is in map space; shift the patch the same way.
  const lonShift = cell.lon - axisCoordinate(spec, "lon", cell.lonIndex);
  const latEdgeA = axisCoordinate(spec, "lat", firstLatIdx);
  const latEdgeB = axisCoordinate(spec, "lat", lastLatIdx);
  const lonEdgeA = axisCoordinate(spec, "lon", firstLonIdx) + lonShift;
  const lonEdgeB = axisCoordinate(spec, "lon", lastLonIdx) + lonShift;

  const halfLon = Math.abs(grid.lonStep) / 2;
  const halfLat = Math.abs(grid.latStep) / 2;

  return {
    west: Math.min(lonEdgeA, lonEdgeB) - halfLon,
    east: Math.max(lonEdgeA, lonEdgeB) + halfLon,
    south: Math.min(latEdgeA, latEdgeB) - halfLat,
    north: Math.max(latEdgeA, latEdgeB) + halfLat,
  };
}

export type LonLatPath = [lon: number, lat: number][];

/** Dotted guide lines from each cell edge to the viewport border. */
export function gridCellToGuidePaths(
  cell: GridCellBounds,
  viewport: GridCellBounds,
): LonLatPath[] {
  const centerLon = (cell.west + cell.east) / 2;
  const centerLat = (cell.south + cell.north) / 2;

  return [
    [
      [centerLon, cell.north],
      [centerLon, viewport.north],
    ],
    [
      [centerLon, cell.south],
      [centerLon, viewport.south],
    ],
    [
      [cell.east, centerLat],
      [viewport.east, centerLat],
    ],
    [
      [cell.west, centerLat],
      [viewport.west, centerLat],
    ],
  ];
}

const GLOBE_GUIDE_STEP_DEG = 2;

/** Add intermediate points so lines drape on the globe surface. */
export function densifyLonLatPath(path: LonLatPath, stepDeg = GLOBE_GUIDE_STEP_DEG): LonLatPath {
  if (path.length < 2) return path;

  const [start, end] = [path[0], path[path.length - 1]];
  const [lon0, lat0] = start;
  const [lon1, lat1] = end;
  const result: LonLatPath = [start];

  if (Math.abs(lon0 - lon1) < 1e-9) {
    const minLat = Math.min(lat0, lat1);
    const maxLat = Math.max(lat0, lat1);
    for (let lat = minLat + stepDeg; lat < maxLat; lat += stepDeg) {
      result.push([lon0, lat]);
    }
  } else if (Math.abs(lat0 - lat1) < 1e-9) {
    const minLon = Math.min(lon0, lon1);
    const maxLon = Math.max(lon0, lon1);
    for (let lon = minLon + stepDeg; lon < maxLon; lon += stepDeg) {
      result.push([lon, lat0]);
    }
  }

  result.push(end);
  return result;
}

export type SelectionGuideGeoJson = {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    properties: { kind: "guide" | "cell" | "patch" };
    geometry:
      | { type: "LineString"; coordinates: LonLatPath }
      | { type: "Polygon"; coordinates: LonLatPath[] };
  }>;
};

function closedRing(corners: GeoPoint[]): LonLatPath {
  const ring: LonLatPath = corners.map((point) => [point.lon, point.lat]);
  ring.push(ring[0]);
  return ring;
}

/** GeoJSON for MapLibre selection overlays that drape on the globe surface. */
export function selectionGuideGeoJson(
  cell: GridCell,
  guidePaths: LonLatPath[],
  options?: {
    densifyGuides?: boolean;
    patchBounds?: GridCellBounds | null;
    spec?: GridSpec;
  },
): SelectionGuideGeoJson {
  const densifyGuides = options?.densifyGuides ?? true;
  const patchBounds = options?.patchBounds ?? null;
  const spec = options?.spec ?? DEFAULT_GRID_SPEC;

  return {
    type: "FeatureCollection",
    features: [
      ...guidePaths.map((path) => ({
        type: "Feature" as const,
        properties: { kind: "guide" as const },
        geometry: {
          type: "LineString" as const,
          coordinates: densifyGuides ? densifyLonLatPath(path) : path,
        },
      })),
      ...(patchBounds
        ? [
            {
              type: "Feature" as const,
              properties: { kind: "patch" as const },
              geometry: {
                type: "Polygon" as const,
                coordinates: [closedRing(boundsToPolygon(patchBounds))],
              },
            },
          ]
        : []),
      {
        type: "Feature",
        properties: { kind: "cell" },
        geometry: { type: "Polygon", coordinates: [closedRing(gridCellToPolygon(cell, spec))] },
      },
    ],
  };
}

export function formatLatitude(lat: number, digits = 3): string {
  const dir = lat >= 0 ? "N" : "S";
  return `${Math.abs(lat).toFixed(digits)}°${dir}`;
}

export function formatLongitude(lon: number, digits = 3): string {
  const dir = lon >= 0 ? "E" : "W";
  return `${Math.abs(lon).toFixed(digits)}°${dir}`;
}

export function formatCoordinate(value: number, digits = 3): string {
  const direction = value >= 0 ? "" : "-";
  return `${direction}${Math.abs(value).toFixed(digits)}°`;
}

export function formatGeoPoint(point: GeoPoint, digits = 3): string {
  return `${formatLongitude(point.lon, digits)}, ${formatLatitude(point.lat, digits)}`;
}
