import type { LayerSpecification } from "maplibre-gl";
import {
  chunkPatchBounds,
  gridCellToBounds,
  gridCellToGuidePaths,
  selectionGuideGeoJson,
} from "@/lib/map/geogrid";
import {
  rgba,
  SELECTION_CELL_COLOR,
  SELECTION_GUIDE_COLOR,
  SELECTION_PATCH_COLOR,
} from "@/lib/map/selectionStyle";
import { viewportToGeoBounds } from "@/lib/map/viewportBounds";
import type { PatchWindowSize } from "@/lib/settings/patchWindow";
import type { GridCell, GridSpec, MapViewState } from "@/types/map";

export const SELECTION_SOURCE_ID = "map-selection";

type SelectionDataInput = {
  cell: GridCell;
  gridSpec: GridSpec;
  viewState: MapViewState;
  mapSize: { width: number; height: number };
  isSphere: boolean;
  patchWindow: PatchWindowSize | null;
};

export function selectionData({
  cell,
  gridSpec,
  viewState,
  mapSize,
  isSphere,
  patchWindow,
}: SelectionDataInput) {
  const guidePaths = gridCellToGuidePaths(
    gridCellToBounds(cell, gridSpec),
    viewportToGeoBounds(viewState, mapSize.width, mapSize.height),
  );
  return selectionGuideGeoJson(cell, guidePaths, {
    densifyGuides: isSphere,
    spec: gridSpec,
    // Outlines what is kept, not the 40x40 chunk that was downloaded.
    patchBounds:
      patchWindow === null
        ? null
        : chunkPatchBounds(cell, patchWindow, patchWindow, gridSpec),
  });
}

export function selectionLayers(isLight: boolean): LayerSpecification[] {
  const theme = isLight ? "light" : "dark";
  const cell = SELECTION_CELL_COLOR[theme];
  const patch = SELECTION_PATCH_COLOR[theme];
  const source = SELECTION_SOURCE_ID;

  return [
    {
      id: "map-selection-guides",
      type: "line",
      source,
      filter: ["==", ["get", "kind"], "guide"],
      paint: {
        "line-color": rgba(SELECTION_GUIDE_COLOR[theme]),
        "line-width": 1,
        "line-dasharray": [6, 5],
      },
    },
    {
      id: "map-selection-patch-fill",
      type: "fill",
      source,
      filter: ["==", ["get", "kind"], "patch"],
      paint: { "fill-color": rgba(patch.fill) },
    },
    {
      id: "map-selection-patch-line",
      type: "line",
      source,
      filter: ["==", ["get", "kind"], "patch"],
      paint: {
        "line-color": rgba(patch.line),
        "line-width": 1.5,
        "line-dasharray": [3, 3],
      },
    },
    {
      id: "map-selection-cell-fill",
      type: "fill",
      source,
      filter: ["==", ["get", "kind"], "cell"],
      paint: { "fill-color": rgba(cell.fill) },
    },
    {
      id: "map-selection-cell-line",
      type: "line",
      source,
      filter: ["==", ["get", "kind"], "cell"],
      paint: { "line-color": rgba(cell.line), "line-width": 2 },
    },
  ];
}
