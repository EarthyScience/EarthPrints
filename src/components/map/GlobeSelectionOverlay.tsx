"use client";

import { useMemo } from "react";
import { Layer, Source } from "react-map-gl/maplibre";
import {
  SELECTION_SOURCE_ID,
  selectionData,
  selectionLayers,
} from "@/lib/map/selectionLayers";
import type { PatchWindowSize } from "@/lib/settings/patchWindow";
import type { GridCell, GridSpec, MapViewState } from "@/types/map";

type GlobeSelectionOverlayProps = {
  cell: GridCell;
  gridSpec: GridSpec;
  viewState: MapViewState;
  mapSize: { width: number; height: number };
  isLight: boolean;
  isSphere: boolean;
  patchWindow: PatchWindowSize | null;
};

export function GlobeSelectionOverlay({
  cell,
  gridSpec,
  viewState,
  mapSize,
  isLight,
  isSphere,
  patchWindow,
}: GlobeSelectionOverlayProps) {
  const data = useMemo(
    () =>
      selectionData({
        cell,
        gridSpec,
        viewState,
        mapSize,
        isSphere,
        patchWindow,
      }),
    [cell, gridSpec, viewState, mapSize, isSphere, patchWindow],
  );
  const layers = useMemo(() => selectionLayers(isLight), [isLight]);

  return (
    <Source id={SELECTION_SOURCE_ID} type="geojson" data={data}>
      {layers.map((layer) => (
        <Layer key={layer.id} {...layer} />
      ))}
    </Source>
  );
}
