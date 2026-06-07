import { ESDC_TEST_DATASET } from "@/lib/constants/esdc";
import type { GeoPoint, GridCell } from "@/types/map";

const { grid, dimensions } = ESDC_TEST_DATASET;

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

/** Snap a WGS-84 point to the nearest ESDC 2.5° grid cell. */
export function geoPointToEsdcGrid(point: GeoPoint): GridCell {
  const lon = snapToAxis(point.lon, grid.lonStart, grid.lonStep, dimensions.lon);
  const lat = snapToAxis(point.lat, grid.latStart, grid.latStep, dimensions.lat);

  return {
    lon: lon.coordinate,
    lat: lat.coordinate,
    lonIndex: lon.index,
    latIndex: lat.index,
  };
}

export function formatCoordinate(value: number, digits = 2): string {
  const direction = value >= 0 ? "" : "-";
  return `${direction}${Math.abs(value).toFixed(digits)}°`;
}

export function formatGeoPoint(point: GeoPoint, digits = 2): string {
  return `${formatCoordinate(point.lon, digits)}, ${formatCoordinate(point.lat, digits)}`;
}
