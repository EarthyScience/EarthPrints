"use client";

import { useMemo } from "react";
import { Layer, Source } from "react-map-gl/maplibre";
import {
  chunkPatchBounds,
  gridCellToBounds,
  gridCellToGuidePaths,
  selectionGuideGeoJson,
} from "@/lib/map/geogrid";
import { DEFAULT_GRID_SPEC } from "@/lib/constants/store";
import {
  rgba,
  SELECTION_CELL_COLOR,
  SELECTION_GUIDE_COLOR,
  SELECTION_PATCH_COLOR,
} from "@/lib/map/selectionStyle";
import { viewportToGeoBounds } from "@/lib/map/viewportBounds";
import {
  DEFAULT_PATCH_WINDOW,
  type PatchWindowSize,
} from "@/lib/settings/patchWindow";
import type { GridCell, GridSpec, MapViewState } from "@/types/map";

type GlobeSelectionOverlayProps = {
  cell: GridCell;
  gridSpec?: GridSpec;
  viewState: MapViewState;
  mapSize: { width: number; height: number };
  isLight: boolean;
  isSphere?: boolean;
  showPatch?: boolean;
  /** Cells kept per side, which is what the box outlines. */
  patchWindow?: PatchWindowSize;
};

export function GlobeSelectionOverlay({
  cell,
  gridSpec = DEFAULT_GRID_SPEC,
  viewState,
  mapSize,
  isLight,
  isSphere = false,
  showPatch = false,
  patchWindow = DEFAULT_PATCH_WINDOW,
}: GlobeSelectionOverlayProps) {
  const data = useMemo(() => {
    const guidePaths = gridCellToGuidePaths(
      gridCellToBounds(cell, gridSpec),
      viewportToGeoBounds(viewState, mapSize.width, mapSize.height),
    );
    return selectionGuideGeoJson(cell, guidePaths, {
      densifyGuides: isSphere,
      spec: gridSpec,
      // The box outlines what is kept, not what is downloaded: the window
      // tiles the 40x40 chunk, so at 40 the two are the same box.
      patchBounds: showPatch
        ? chunkPatchBounds(cell, patchWindow, patchWindow, gridSpec)
        : null,
    });
  }, [
    cell,
    gridSpec,
    isSphere,
    mapSize.height,
    mapSize.width,
    patchWindow,
    showPatch,
    viewState,
  ]);

  const guideColor = rgba(
    isLight ? SELECTION_GUIDE_COLOR.light : SELECTION_GUIDE_COLOR.dark,
  );
  const cellColor = isLight ? SELECTION_CELL_COLOR.light : SELECTION_CELL_COLOR.dark;
  const patchColor = isLight
    ? SELECTION_PATCH_COLOR.light
    : SELECTION_PATCH_COLOR.dark;

  return (
    <Source id="map-selection" type="geojson" data={data}>
      <Layer
        id="map-selection-guides"
        type="line"
        filter={["==", ["get", "kind"], "guide"]}
        paint={{
          "line-color": guideColor,
          "line-width": 1,
          "line-dasharray": [6, 5],
        }}
      />
      <Layer
        id="map-selection-patch-fill"
        type="fill"
        filter={["==", ["get", "kind"], "patch"]}
        paint={{
          "fill-color": rgba(patchColor.fill),
        }}
      />
      <Layer
        id="map-selection-patch-line"
        type="line"
        filter={["==", ["get", "kind"], "patch"]}
        paint={{
          "line-color": rgba(patchColor.line),
          "line-width": 1.5,
          "line-dasharray": [3, 3],
        }}
      />
      <Layer
        id="map-selection-cell-fill"
        type="fill"
        filter={["==", ["get", "kind"], "cell"]}
        paint={{
          "fill-color": rgba(cellColor.fill),
        }}
      />
      <Layer
        id="map-selection-cell-line"
        type="line"
        filter={["==", ["get", "kind"], "cell"]}
        paint={{
          "line-color": rgba(cellColor.line),
          "line-width": 2,
        }}
      />
    </Source>
  );
}
