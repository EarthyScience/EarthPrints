import type { TransitionInterpolator } from "@deck.gl/core";

export type GeoPoint = {
  lon: number;
  lat: number;
};

export type GridCell = GeoPoint & {
  lonIndex: number;
  latIndex: number;
};

/**
 * Everything the map geometry needs to know about the dataset's spatial grid.
 * Hardcoded as a fallback in `@/lib/constants/store` and derived from the
 * remote store's metadata at runtime by `@/lib/zarr/gridSpec`.
 */
export type GridSpec = {
  /** Cell-center coordinates of the first cell and per-cell step on each axis. */
  grid: {
    lonStart: number;
    lonStep: number;
    latStart: number;
    latStep: number;
  };
  /** Sizes of each array dimension. */
  dimensions: {
    time: number;
    hour: number;
    lon: number;
    lat: number;
  };
  /** On-disk chunk footprint along lat/lon (cells per patch side). */
  nativeChunks: {
    lat: number;
    lon: number;
  };
  /** Cell size in degrees (absolute lon step). */
  spatialResolutionDeg: number;
};

export type MapSelection = {
  click: GeoPoint;
  grid: GridCell;
};

export type MapViewMode = "2d" | "sphere";

export type MapViewState = {
  longitude: number;
  latitude: number;
  zoom: number;
  bearing?: number;
  pitch?: number;
  transitionDuration?: number;
  transitionInterpolator?: TransitionInterpolator;
};
