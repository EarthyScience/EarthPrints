import type {
  ExpressionSpecification,
  LayerSpecification,
  Map as MapLibreMap,
  StyleSpecification,
} from "maplibre-gl";
import { MAP_BASE_STYLES } from "@/lib/map/viewState";

/** Country and major-city labels at world/region zoom. */
export const DARK_MAP_PRIMARY_LABEL_COLOR = "#ffffff";

/** State and city labels when zoomed in further. */
export const DARK_MAP_SECONDARY_LABEL_COLOR = "rgba(255, 255, 255, 0.9)";

/** Dark halo keeps white labels legible over land and water. */
export const DARK_MAP_LABEL_HALO_COLOR = "rgba(0, 0, 0, 0.92)";

export const DARK_MAP_LABEL_HALO_WIDTH = 1.6;

/** English/Latin only — avoids stacked bilingual lines that crowd the map. */
export const SINGLE_LINE_LABEL_TEXT_FIELD: ExpressionSpecification = [
  "coalesce",
  ["get", "name_en"],
  ["get", "name:latin"],
  ["get", "name"],
];

const PRIMARY_DARK_LABEL_LAYERS = new Set([
  "place_country_major",
  "place_country_minor",
  "place_country_other",
  "place_city_large",
  "water_name",
]);

/** Minimum zoom before smaller admin/city labels appear. */
const DARK_LABEL_MIN_ZOOM: Partial<Record<string, number>> = {
  place_city_large: 3,
  place_state: 5,
  place_city: 6,
  place_town: 7,
  place_village: 8,
  place_suburb: 9,
  place_other: 9,
};

export function isPlaceLabelLayer(layerId: string): boolean {
  return layerId.startsWith("place_");
}

export function isDarkBasemapTextLayer(layerId: string): boolean {
  if (layerId.startsWith("highway_")) return false;
  return isPlaceLabelLayer(layerId) || layerId === "water_name";
}

export function isPrimaryDarkBasemapTextLayer(layerId: string): boolean {
  return PRIMARY_DARK_LABEL_LAYERS.has(layerId);
}

function patchSymbolLayer(layer: LayerSpecification): LayerSpecification {
  if (layer.type !== "symbol") return layer;

  const layout = layer.layout as Record<string, unknown> | undefined;
  if (!layout?.["text-field"]) return layer;
  if (!isDarkBasemapTextLayer(layer.id)) return layer;

  const isPrimary = isPrimaryDarkBasemapTextLayer(layer.id);
  const minzoom = DARK_LABEL_MIN_ZOOM[layer.id];

  const paint = {
    ...(layer.paint as Record<string, unknown> | undefined),
    "text-color": isPrimary
      ? DARK_MAP_PRIMARY_LABEL_COLOR
      : DARK_MAP_SECONDARY_LABEL_COLOR,
    "text-halo-color": DARK_MAP_LABEL_HALO_COLOR,
    "text-halo-width": DARK_MAP_LABEL_HALO_WIDTH,
  };

  return {
    ...layer,
    ...(minzoom !== undefined ? { minzoom } : {}),
    layout: {
      ...layout,
      "text-field": SINGLE_LINE_LABEL_TEXT_FIELD,
    },
    paint,
  };
}

export function patchDarkMapLabelStyle(
  style: StyleSpecification,
): StyleSpecification {
  return {
    ...style,
    layers: style.layers?.map(patchSymbolLayer) ?? [],
  };
}

let darkMapStylePromise: Promise<StyleSpecification> | null = null;
let darkMapStyleCacheVersion = -1;
const DARK_MAP_STYLE_PATCH_VERSION = 3;

export function loadDarkMapStyle(): Promise<StyleSpecification> {
  if (
    !darkMapStylePromise ||
    darkMapStyleCacheVersion !== DARK_MAP_STYLE_PATCH_VERSION
  ) {
    darkMapStyleCacheVersion = DARK_MAP_STYLE_PATCH_VERSION;
    darkMapStylePromise = fetch(MAP_BASE_STYLES.dark)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Could not load dark map style (${response.status}).`);
        }
        return response.json() as Promise<StyleSpecification>;
      })
      .then(patchDarkMapLabelStyle);
  }

  return darkMapStylePromise;
}

/** Brighten city/country labels in the dark basemap; leaves roads and fills unchanged. */
export function brightenDarkMapPlaceLabels(map: MapLibreMap): void {
  const style = map.getStyle();
  if (!style?.layers) return;

  for (const layer of style.layers) {
    if (layer.type !== "symbol") continue;
    if (!layer.layout?.["text-field"]) continue;
    if (!isDarkBasemapTextLayer(layer.id)) continue;

    const isPrimary = isPrimaryDarkBasemapTextLayer(layer.id);
    map.setPaintProperty(
      layer.id,
      "text-color",
      isPrimary ? DARK_MAP_PRIMARY_LABEL_COLOR : DARK_MAP_SECONDARY_LABEL_COLOR,
    );
    map.setPaintProperty(layer.id, "text-halo-color", DARK_MAP_LABEL_HALO_COLOR);
    map.setPaintProperty(
      layer.id,
      "text-halo-width",
      DARK_MAP_LABEL_HALO_WIDTH,
    );
    map.setLayoutProperty(layer.id, "text-field", SINGLE_LINE_LABEL_TEXT_FIELD);

    const minzoom = DARK_LABEL_MIN_ZOOM[layer.id];
    if (minzoom !== undefined) {
      map.setLayerZoomRange(layer.id, minzoom, layer.maxzoom ?? 24);
    }
  }
}
