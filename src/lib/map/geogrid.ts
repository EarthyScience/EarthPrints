import { ZARR_STORE } from "@/lib/constants/store";
import type { GeoPoint, GridCell } from "@/types/map";

const { grid, dimensions } = ZARR_STORE;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function snapToAxis(value: number, start: number, step: number, count: number): {
  index: number;
  coordinate: number;
} {
  const index = clamp(Math.round((value - start) / step), 0, count - 1);
  return {
    index,
    coordinate: start + index * step,
  };
}

/** Snap a WGS-84 point to the nearest Zarr grid cell center. */
export function geoPointToZarrGrid(point: GeoPoint): GridCell {
  const lon = snapToAxis(point.lon, grid.lonStart, grid.lonStep, dimensions.lon);
  const lat = snapToAxis(point.lat, grid.latStart, grid.latStep, dimensions.lat);

  return {
    lon: lon.coordinate,
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
export function gridCellToBounds(cell: GridCell): GridCellBounds {
  const halfLon = Math.abs(grid.lonStep) / 2;
  const halfLat = Math.abs(grid.latStep) / 2;

  return {
    west: cell.lon - halfLon,
    east: cell.lon + halfLon,
    south: cell.lat - halfLat,
    north: cell.lat + halfLat,
  };
}

/** Closed lon/lat ring for the cell footprint (counter-clockwise). */
export function gridCellToPolygon(cell: GridCell): GeoPoint[] {
  const { west, east, south, north } = gridCellToBounds(cell);

  return [
    { lon: west, lat: north },
    { lon: east, lat: north },
    { lon: east, lat: south },
    { lon: west, lat: south },
  ];
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
    properties: { kind: "guide" | "cell" };
    geometry:
      | { type: "LineString"; coordinates: LonLatPath }
      | { type: "Polygon"; coordinates: LonLatPath[] };
  }>;
};

/** GeoJSON for MapLibre selection overlays that drape on the globe surface. */
export function selectionGuideGeoJson(
  cell: GridCell,
  guidePaths: LonLatPath[],
): SelectionGuideGeoJson {
  const corners = gridCellToPolygon(cell);
  const ring: LonLatPath = corners.map((point) => [point.lon, point.lat]);
  ring.push(ring[0]);

  return {
    type: "FeatureCollection",
    features: [
      ...guidePaths.map((path) => ({
        type: "Feature" as const,
        properties: { kind: "guide" as const },
        geometry: {
          type: "LineString" as const,
          coordinates: densifyLonLatPath(path),
        },
      })),
      {
        type: "Feature",
        properties: { kind: "cell" },
        geometry: { type: "Polygon", coordinates: [ring] },
      },
    ],
  };
}

export function formatCoordinate(value: number, digits = 3): string {
  const direction = value >= 0 ? "" : "-";
  return `${direction}${Math.abs(value).toFixed(digits)}°`;
}

export function formatGeoPoint(point: GeoPoint, digits = 3): string {
  return `${formatCoordinate(point.lon, digits)}, ${formatCoordinate(point.lat, digits)}`;
}
