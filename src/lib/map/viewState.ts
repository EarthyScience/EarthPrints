import { FlyToInterpolator } from "@deck.gl/core";
import type { GridCell, MapViewState } from "@/types/map";

export const DEFAULT_MAP_VIEW: MapViewState = {
  longitude: 10,
  latitude: 30,
  zoom: 1.4,
  bearing: 0,
  pitch: 0,
};

/** Minimum zoom when focusing a selected 0.05° grid cell. */
export const SELECTION_FOCUS_ZOOM = 9;

export const SELECTION_FOCUS_TRANSITION_MS = 1000;

const selectionFocusInterpolator = new FlyToInterpolator();

/** Center on a snapped cell and zoom in only if the view is still too wide. */
export function viewStateFocusedOnCell(
  current: MapViewState,
  cell: GridCell,
): MapViewState {
  const nextZoom = Math.max(current.zoom, SELECTION_FOCUS_ZOOM);
  const isChangingView =
    current.longitude !== cell.lon ||
    current.latitude !== cell.lat ||
    nextZoom !== current.zoom;

  if (!isChangingView) return current;

  return {
    ...current,
    longitude: cell.lon,
    latitude: cell.lat,
    zoom: nextZoom,
    transitionDuration: SELECTION_FOCUS_TRANSITION_MS,
    transitionInterpolator: selectionFocusInterpolator,
  };
}

export const MAP_BASE_STYLES = {
  dark: "https://tiles.openfreemap.org/styles/dark",
  light: "https://tiles.openfreemap.org/styles/positron",
} as const;
