"use client";

import { useMemo } from "react";
import { Layer, Source } from "react-map-gl/maplibre";
import {
  chunkPatchBounds,
  gridCellToBounds,
  gridCellToGuidePaths,
  selectionGuideGeoJson,
} from "@/lib/map/geogrid";
import { ZARR_STORE } from "@/lib/constants/store";
import {
  rgba,
  SELECTION_CELL_COLOR,
  SELECTION_GUIDE_COLOR,
  SELECTION_PATCH_COLOR,
} from "@/lib/map/selectionStyle";
import { viewportToGeoBounds } from "@/lib/map/viewportBounds";
import type { GridCell, MapViewState } from "@/types/map";

type GlobeSelectionOverlayProps = {
  cell: GridCell;
  viewState: MapViewState;
  mapSize: { width: number; height: number };
  isLight: boolean;
  isSphere?: boolean;
  showPatch?: boolean;
};

export function GlobeSelectionOverlay({
  cell,
  viewState,
  mapSize,
  isLight,
  isSphere = false,
  showPatch = false,
}: GlobeSelectionOverlayProps) {
  const data = useMemo(() => {
    const guidePaths = gridCellToGuidePaths(
      gridCellToBounds(cell),
      viewportToGeoBounds(viewState, mapSize.width, mapSize.height),
    );
    return selectionGuideGeoJson(cell, guidePaths, {
      densifyGuides: isSphere,
      patchBounds: showPatch
        ? chunkPatchBounds(cell, ZARR_STORE.nativeChunks.lat, ZARR_STORE.nativeChunks.lon)
        : null,
    });
  }, [cell, isSphere, mapSize.height, mapSize.width, showPatch, viewState]);

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
