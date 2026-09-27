import { Map as MapLibreMap } from "maplibre-gl";
import "@/lib/map/initMaplibre";
import {
  SELECTION_SOURCE_ID,
  selectionData,
  selectionLayers,
} from "@/lib/map/selectionLayers";
import { MAP_BASE_STYLES, SELECTION_FOCUS_ZOOM } from "@/lib/map/viewState";
import {
  canvasToPng,
  createOffscreenHost,
  whenVisible,
  type CapturedImage,
} from "@/lib/export/capture";
import { collectAttribution } from "@/lib/export/mapSnapshot";
import type { GridCell, GridSpec } from "@/types/map";

// Same aspect as the report's 88mm x 47mm map box.
const MAP_WIDTH = 704;
const MAP_HEIGHT = 376;
const PIXEL_RATIO = 2;
const LOAD_TIMEOUT_MS = 8000;
const TILE_TIMEOUT_MS = 6000;

export type MapCapture = {
  image: CapturedImage | null;
  attribution: string;
};

function waitFor(map: MapLibreMap, event: "load" | "idle", timeoutMs: number) {
  return new Promise<boolean>((resolve) => {
    const timer = setTimeout(() => {
      map.off(event, done);
      resolve(false);
    }, timeoutMs);
    const done = () => {
      clearTimeout(timer);
      resolve(true);
    };
    map.once(event, done);
  });
}

// Never throws: the report prints without a map rather than failing.
export async function captureMap({
  cell,
  gridSpec,
}: {
  cell: GridCell;
  gridSpec: GridSpec;
}): Promise<MapCapture> {
  await whenVisible();

  const host = createOffscreenHost(MAP_WIDTH, MAP_HEIGHT);
  const map = new MapLibreMap({
    container: host,
    style: MAP_BASE_STYLES.light,
    center: [cell.lon, cell.lat],
    zoom: SELECTION_FOCUS_ZOOM,
    interactive: false,
    attributionControl: false,
    pixelRatio: PIXEL_RATIO,
    canvasContextAttributes: { preserveDrawingBuffer: true },
  });

  try {
    if (!(await waitFor(map, "load", LOAD_TIMEOUT_MS))) {
      return { image: null, attribution: "" };
    }

    map.addSource(SELECTION_SOURCE_ID, {
      type: "geojson",
      data: selectionData({
        cell,
        gridSpec,
        viewState: {
          longitude: cell.lon,
          latitude: cell.lat,
          zoom: SELECTION_FOCUS_ZOOM,
        },
        mapSize: { width: MAP_WIDTH, height: MAP_HEIGHT },
        isSphere: false,
        patchWindow: null,
      }),
    });
    for (const layer of selectionLayers(true)) map.addLayer(layer);

    if (!map.areTilesLoaded() || !map.isStyleLoaded()) {
      await waitFor(map, "idle", TILE_TIMEOUT_MS);
    }
    map.redraw();

    return {
      image: canvasToPng(map.getCanvas()),
      attribution: collectAttribution(map.getStyle()?.sources),
    };
  } catch (cause) {
    console.error("Map capture failed", cause);
    return { image: null, attribution: "" };
  } finally {
    map.remove();
    host.remove();
  }
}
