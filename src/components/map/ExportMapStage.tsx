"use client";

import { createRoot } from "react-dom/client";
import Map from "react-map-gl/maplibre";
import type { Map as MapLibreMap, MapLibreEvent } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { GlobeSelectionOverlay } from "@/components/map/GlobeSelectionOverlay";
import {
  MAP_BASE_STYLES,
  SELECTION_FOCUS_ZOOM,
} from "@/lib/map/viewState";
import {
  canvasToPng,
  createOffscreenHost,
  whenVisible,
  type CapturedImage,
} from "@/lib/export/capture";
import { collectAttribution } from "@/lib/export/mapSnapshot";
import type { GridCell, GridSpec, MapViewState } from "@/types/map";

/**
 * Stage size in CSS px, at the aspect ratio of the report's map box (88mm x
 * 47mm). Matching it means the panel prints the whole frame instead of a
 * centre crop of one shaped like the screen.
 */
const EXPORT_MAP_WIDTH = 704;
const EXPORT_MAP_HEIGHT = 376;

/**
 * Fixed rather than inherited from the display, so the printed map has the same
 * ~400dpi on every machine. 2 is where the labels stay crisp in print without
 * the PNG dominating the file size.
 */
const EXPORT_MAP_PIXEL_RATIO = 2;

/** Style, glyphs and the first tiles, over the network. */
const LOAD_TIMEOUT_MS = 8000;

/** Extra grace for the remaining tiles once the map itself is up. */
const TILE_TIMEOUT_MS = 6000;

const MAP_CANVAS_ATTRIBUTES = { preserveDrawingBuffer: true } as const;

export type MapCapture = {
  /** Null when the offscreen map could not be drawn; the report prints a note. */
  image: CapturedImage | null;
  /** Basemap credit, which the on-screen map hides but a distributed file must carry. */
  attribution: string;
};

type CaptureOptions = {
  cell: GridCell;
  gridSpec: GridSpec;
};

/**
 * The map as the report wants it, which is not the map on screen: always plan
 * view, always the light basemap, always framed on the selected cell. The live
 * map can be a dark globe tilted off its axis, and printing that into a light
 * A4 report gives a black sphere floating in a white page.
 */
function ExportMapStage({
  cell,
  gridSpec,
  onReady,
}: CaptureOptions & { onReady: (map: MapLibreMap) => void }) {
  const viewState: MapViewState = {
    longitude: cell.lon,
    latitude: cell.lat,
    zoom: SELECTION_FOCUS_ZOOM,
    bearing: 0,
    pitch: 0,
  };

  return (
    <Map
      mapStyle={MAP_BASE_STYLES.light}
      initialViewState={viewState}
      interactive={false}
      attributionControl={false}
      // Without it the drawing buffer is cleared after each paint, and there is
      // nothing left to read back.
      canvasContextAttributes={MAP_CANVAS_ATTRIBUTES}
      onLoad={(event: MapLibreEvent) => onReady(event.target)}
      style={{ width: EXPORT_MAP_WIDTH, height: EXPORT_MAP_HEIGHT }}
    >
      <GlobeSelectionOverlay
        cell={cell}
        gridSpec={gridSpec}
        viewState={viewState}
        mapSize={{ width: EXPORT_MAP_WIDTH, height: EXPORT_MAP_HEIGHT }}
        isLight
        isSphere={false}
      />
    </Map>
  );
}

/**
 * Resolve once the map has nothing left to draw, or once the grace period runs
 * out. A timeout is not a failure: a map missing its outermost tiles still
 * prints usefully, so whatever has painted by then is what gets captured.
 */
function waitForIdle(map: MapLibreMap, timeoutMs: number): Promise<void> {
  if (map.areTilesLoaded() && map.isStyleLoaded()) return Promise.resolve();

  return new Promise((resolve) => {
    const finish = () => {
      clearTimeout(timer);
      map.off("idle", finish);
      resolve();
    };
    const timer = setTimeout(finish, timeoutMs);
    map.on("idle", finish);
  });
}

/**
 * Mount a map offscreen, wait for it to settle, and rasterise it for the
 * report. The stage is torn down before this resolves.
 *
 * Never throws: the report treats a missing map as a layout case, and a failed
 * basemap is not a reason to lose the data the user asked to download.
 */
export async function captureMapForExport({
  cell,
  gridSpec,
}: CaptureOptions): Promise<MapCapture> {
  // A hidden tab paints nothing and fetches no tiles, so the load and idle
  // budgets below would run out on a map that never had a chance to draw.
  await whenVisible();

  const host = createOffscreenHost(EXPORT_MAP_WIDTH, EXPORT_MAP_HEIGHT);
  const root = createRoot(host);

  try {
    const map = await new Promise<MapLibreMap | null>((resolve) => {
      const timer = setTimeout(() => resolve(null), LOAD_TIMEOUT_MS);
      root.render(
        <ExportMapStage
          cell={cell}
          gridSpec={gridSpec}
          onReady={(instance) => {
            clearTimeout(timer);
            resolve(instance);
          }}
        />,
      );
    });

    if (!map) return { image: null, attribution: "" };

    map.setPixelRatio(EXPORT_MAP_PIXEL_RATIO);
    await waitForIdle(map, TILE_TIMEOUT_MS);
    // The buffer holds the last painted frame, and the pixel-ratio resize may
    // still be pending, so force one more frame before reading it back.
    map.redraw();

    return {
      image: canvasToPng(map.getCanvas()),
      attribution: collectAttribution(map.getStyle()?.sources),
    };
  } catch (cause) {
    console.error("Map capture failed", cause);
    return { image: null, attribution: "" };
  } finally {
    root.unmount();
    host.remove();
  }
}
