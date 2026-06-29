import { FlyToInterpolator } from "@deck.gl/core";
import type { GridCell, MapViewMode, MapViewState } from "@/types/map";

export const DEFAULT_MAP_VIEW: MapViewState = {
  longitude: 10,
  latitude: 30,
  zoom: 1.4,
  bearing: 0,
  pitch: 0,
};

export const VIEW_MODE_TRANSITION_MS = 500;

const viewModeInterpolator = new FlyToInterpolator();

export function viewStateForMode(
  current: MapViewState,
  mode: MapViewMode,
): MapViewState {
  const target =
    mode === "sphere"
      ? {
          ...current,
          pitch: 0,
          bearing: 0,
          zoom: Math.min(current.zoom, 1.1),
        }
      : {
          ...current,
          pitch: 0,
          bearing: 0,
        };

  if (
    target.longitude === current.longitude &&
    target.latitude === current.latitude &&
    target.zoom === current.zoom &&
    (target.pitch ?? 0) === (current.pitch ?? 0) &&
    (target.bearing ?? 0) === (current.bearing ?? 0)
  ) {
    return current;
  }

  return {
    ...target,
    transitionDuration: VIEW_MODE_TRANSITION_MS,
    transitionInterpolator: viewModeInterpolator,
  };
}

/** Minimum zoom when focusing a selected 0.05° grid cell in plan view. */
export const SELECTION_FOCUS_ZOOM = 9;

/** Minimum zoom when focusing a selected cell on the globe. */
export const SPHERE_SELECTION_FOCUS_ZOOM = 10;

export const SELECTION_FOCUS_TRANSITION_MS = 1000;

const selectionFocusInterpolator = new FlyToInterpolator();

/** Center on a snapped cell and zoom in only if the view is still too wide. */
export function viewStateFocusedOnCell(
  current: MapViewState,
  cell: GridCell,
  mode: MapViewMode = "2d",
): MapViewState {
  const focusZoom =
    mode === "sphere" ? SPHERE_SELECTION_FOCUS_ZOOM : SELECTION_FOCUS_ZOOM;
  const nextZoom = Math.max(current.zoom, focusZoom);
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
    pitch: 0,
    transitionDuration: SELECTION_FOCUS_TRANSITION_MS,
    transitionInterpolator: selectionFocusInterpolator,
  };
}

export const MAP_BASE_STYLES = {
  dark: "https://tiles.openfreemap.org/styles/dark",
  light: "https://tiles.openfreemap.org/styles/positron",
} as const;
