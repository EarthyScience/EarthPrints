import { WebMercatorViewport } from "@deck.gl/core";
import type { GridCellBounds } from "@/lib/map/geogrid";
import type { MapViewState } from "@/types/map";

/** Geographic bounds of the visible map viewport. */
export function viewportToGeoBounds(
  viewState: MapViewState,
  width: number,
  height: number,
): GridCellBounds {
  const viewport = new WebMercatorViewport({
    width,
    height,
    longitude: viewState.longitude,
    latitude: viewState.latitude,
    zoom: viewState.zoom,
    bearing: viewState.bearing ?? 0,
    pitch: viewState.pitch ?? 0,
  });

  const [west, north] = viewport.unproject([0, 0]);
  const [east, south] = viewport.unproject([width, height]);

  return {
    west: Math.min(west, east),
    east: Math.max(west, east),
    south: Math.min(south, north),
    north: Math.max(south, north),
  };
}
