"use client";

import { useMemo } from "react";
import { Layer, Source } from "react-map-gl/maplibre";
import {
  gridCellToBounds,
  gridCellToGuidePaths,
  selectionGuideGeoJson,
} from "@/lib/map/geogrid";
import { rgba, SELECTION_CELL_COLOR, SELECTION_GUIDE_COLOR } from "@/lib/map/selectionStyle";
import { viewportToGeoBounds } from "@/lib/map/viewportBounds";
import type { GridCell, MapViewState } from "@/types/map";

type GlobeSelectionOverlayProps = {
  cell: GridCell;
  viewState: MapViewState;
  mapSize: { width: number; height: number };
  isLight: boolean;
};

export function GlobeSelectionOverlay({
  cell,
  viewState,
  mapSize,
  isLight,
}: GlobeSelectionOverlayProps) {
  const data = useMemo(() => {
    const guidePaths = gridCellToGuidePaths(
      gridCellToBounds(cell),
      viewportToGeoBounds(viewState, mapSize.width, mapSize.height),
    );
    return selectionGuideGeoJson(cell, guidePaths);
  }, [cell, mapSize.height, mapSize.width, viewState]);

  const guideColor = rgba(
    isLight ? SELECTION_GUIDE_COLOR.light : SELECTION_GUIDE_COLOR.dark,
  );
  const cellColor = isLight ? SELECTION_CELL_COLOR.light : SELECTION_CELL_COLOR.dark;

  return (
    <Source id="globe-selection" type="geojson" data={data}>
      <Layer
        id="globe-selection-guides"
        type="line"
        filter={["==", ["get", "kind"], "guide"]}
        paint={{
          "line-color": guideColor,
          "line-width": 1,
          "line-dasharray": [6, 5],
        }}
      />
      <Layer
        id="globe-selection-cell-fill"
        type="fill"
        filter={["==", ["get", "kind"], "cell"]}
        paint={{
          "fill-color": rgba(cellColor.fill),
        }}
      />
      <Layer
        id="globe-selection-cell-line"
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
