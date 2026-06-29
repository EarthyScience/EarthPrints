import type { TransitionInterpolator } from "@deck.gl/core";

export type GeoPoint = {
  lon: number;
  lat: number;
};

export type GridCell = GeoPoint & {
  lonIndex: number;
  latIndex: number;
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
