import type {
  ExpressionSpecification,
  SkySpecification,
  StyleSpecification,
} from "maplibre-gl";
import type { Theme } from "@/lib/theme";
import { SINGLE_LINE_LABEL_TEXT_FIELD } from "@/lib/map/mapLabels";

export const DEM_SOURCE_ID = "dem";
export const VECTOR_SOURCE_ID = "openmaptiles";

const MAPTERHORN_TILES = "https://tiles.mapterhorn.com/{z}/{x}/{y}.webp";
const OPENFREEMAP_TILEJSON = "https://tiles.openfreemap.org/planet";
const OPENFREEMAP_GLYPHS =
  "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf";
const MAPTERHORN_ATTRIBUTION =
  '<a href="https://mapterhorn.com/attribution" target="_blank" rel="noopener">© Mapterhorn</a>';

type ReliefPalette = {
  elevation: [number, string][];
  ocean: string;
  water: string;
  waterOpacity: number;
  shadow: string;
  highlight: string;
  accent: string;
  boundary: string;
  label: string;
  labelHalo: string;
  waterLabel: string;
  sky: SkySpecification;
};

// Hypsometric tints in the Natural Earth tradition: greens low, tans and
// browns through the uplands, pale near the summits so relief reads as light.
export const RELIEF_PALETTES: Record<Theme, ReliefPalette> = {
  light: {
    elevation: [
      [-6000, "#a9c9da"],
      [-200, "#c9dfe9"],
      [0, "#b3cfa2"],
      [150, "#c6d8a6"],
      [500, "#dcdcae"],
      [1000, "#e4d2a2"],
      [1800, "#d7b78c"],
      [2800, "#c4a283"],
      [4000, "#cdbcb0"],
      [5500, "#ece6e1"],
      [7000, "#fbfaf8"],
    ],
    ocean: "#c4dce8",
    water: "#bcd7e5",
    waterOpacity: 0.82,
    shadow: "rgba(72, 58, 44, 0.55)",
    highlight: "rgba(255, 255, 255, 0.55)",
    accent: "rgba(96, 80, 62, 0.35)",
    boundary: "rgba(80, 70, 60, 0.35)",
    label: "#3b3833",
    labelHalo: "rgba(255, 255, 255, 0.85)",
    waterLabel: "#5d7f93",
    sky: {
      "sky-color": "#dfeaf1",
      "horizon-color": "#ffffff",
      "fog-color": "#ffffff",
      "sky-horizon-blend": 0.6,
      "horizon-fog-blend": 0.7,
      "fog-ground-blend": 0.4,
      "atmosphere-blend": ["interpolate", ["linear"], ["zoom"], 0, 1, 5, 1, 7, 0],
    },
  },
  dark: {
    elevation: [
      [-6000, "#07111c"],
      [-200, "#0d1b2a"],
      [0, "#1f2b25"],
      [150, "#25322a"],
      [500, "#2d372c"],
      [1000, "#37392d"],
      [1800, "#423d32"],
      [2800, "#4d463d"],
      [4000, "#5e5953"],
      [5500, "#7d7a76"],
      [7000, "#a19f9c"],
    ],
    ocean: "#0a1622",
    water: "#0b1826",
    waterOpacity: 0.85,
    shadow: "rgba(0, 0, 0, 0.75)",
    highlight: "rgba(170, 196, 222, 0.22)",
    accent: "rgba(0, 0, 0, 0.4)",
    boundary: "rgba(210, 220, 230, 0.22)",
    label: "#ffffff",
    labelHalo: "rgba(0, 0, 0, 0.92)",
    waterLabel: "#7f9bb3",
    sky: {
      "sky-color": "#03070d",
      "horizon-color": "#1b3a5e",
      "fog-color": "#0a1622",
      "sky-horizon-blend": 0.5,
      "horizon-fog-blend": 0.6,
      "fog-ground-blend": 0.4,
      "atmosphere-blend": ["interpolate", ["linear"], ["zoom"], 0, 1, 5, 1, 7, 0],
    },
  },
};

function elevationRamp(stops: [number, string][]): ExpressionSpecification {
  return [
    "interpolate",
    ["linear"],
    ["elevation"],
    ...stops.flat(),
  ] as ExpressionSpecification;
}

const LABEL_FONT = ["Noto Sans Regular"];
const LABEL_FONT_BOLD = ["Noto Sans Bold"];

function buildStyle(theme: Theme): StyleSpecification {
  const palette = RELIEF_PALETTES[theme];
  const labelPaint = {
    "text-color": palette.label,
    "text-halo-color": palette.labelHalo,
    "text-halo-width": 1.4,
  };

  return {
    version: 8,
    sky: palette.sky,
    glyphs: OPENFREEMAP_GLYPHS,
    sources: {
      [DEM_SOURCE_ID]: {
        type: "raster-dem",
        tiles: [MAPTERHORN_TILES],
        encoding: "terrarium",
        tileSize: 512,
        attribution: MAPTERHORN_ATTRIBUTION,
      },
      [VECTOR_SOURCE_ID]: {
        type: "vector",
        url: OPENFREEMAP_TILEJSON,
      },
    },
    layers: [
      {
        id: "ocean",
        type: "background",
        paint: { "background-color": palette.ocean },
      },
      {
        id: "relief-tint",
        type: "color-relief",
        source: DEM_SOURCE_ID,
        paint: { "color-relief-color": elevationRamp(palette.elevation) },
      },
      {
        id: "relief-shade",
        type: "hillshade",
        source: DEM_SOURCE_ID,
        paint: {
          "hillshade-method": "multidirectional",
          // Four lights around the north-west keep the classic cartographic
          // lighting while filling in slopes a single sun would flatten.
          "hillshade-illumination-direction": [270, 315, 338, 0],
          "hillshade-illumination-altitude": [35, 45, 35, 60],
          "hillshade-shadow-color": [
            palette.shadow,
            palette.shadow,
            palette.shadow,
            palette.shadow,
          ],
          "hillshade-highlight-color": [
            palette.highlight,
            palette.highlight,
            palette.highlight,
            palette.highlight,
          ],
          "hillshade-accent-color": palette.accent,
        },
      },
      {
        id: "water",
        type: "fill",
        source: VECTOR_SOURCE_ID,
        "source-layer": "water",
        filter: ["!=", ["get", "brunnel"], "tunnel"],
        paint: {
          "fill-color": palette.water,
          "fill-opacity": palette.waterOpacity,
        },
      },
      {
        id: "boundary-country",
        type: "line",
        source: VECTOR_SOURCE_ID,
        "source-layer": "boundary",
        filter: [
          "all",
          ["==", ["get", "admin_level"], 2],
          ["!=", ["get", "maritime"], 1],
        ],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": palette.boundary,
          "line-width": ["interpolate", ["linear"], ["zoom"], 1, 0.5, 8, 1.4],
        },
      },
      {
        id: "label-water",
        type: "symbol",
        source: VECTOR_SOURCE_ID,
        "source-layer": "water_name",
        filter: ["match", ["geometry-type"], ["MultiPoint", "Point"], true, false],
        layout: {
          "text-field": SINGLE_LINE_LABEL_TEXT_FIELD,
          "text-font": ["Noto Sans Italic"],
          "text-size": ["interpolate", ["linear"], ["zoom"], 0, 10, 8, 14],
          "text-letter-spacing": 0.2,
          "text-max-width": 5,
        },
        paint: { ...labelPaint, "text-color": palette.waterLabel },
      },
      {
        id: "label-city",
        type: "symbol",
        source: VECTOR_SOURCE_ID,
        "source-layer": "place",
        minzoom: 4,
        filter: ["==", ["get", "class"], "city"],
        layout: {
          "text-field": SINGLE_LINE_LABEL_TEXT_FIELD,
          "text-font": LABEL_FONT,
          "text-size": ["interpolate", ["exponential", 1.2], ["zoom"], 4, 11, 7, 13, 11, 18],
          "text-max-width": 8,
        },
        paint: labelPaint,
      },
      {
        id: "label-country",
        type: "symbol",
        source: VECTOR_SOURCE_ID,
        "source-layer": "place",
        maxzoom: 9,
        filter: [
          "all",
          ["==", ["get", "class"], "country"],
          ["<=", ["get", "rank"], 2],
        ],
        layout: {
          "text-field": SINGLE_LINE_LABEL_TEXT_FIELD,
          "text-font": LABEL_FONT_BOLD,
          "text-size": ["interpolate", ["linear"], ["zoom"], 1, 9, 5, 16],
          "text-max-width": 6.25,
          "text-transform": "uppercase",
          "text-letter-spacing": 0.08,
        },
        paint: labelPaint,
      },
    ],
  };
}

const styleCache = new Map<Theme, StyleSpecification>();

export function buildReliefStyle(theme: Theme): StyleSpecification {
  let style = styleCache.get(theme);
  if (!style) {
    style = buildStyle(theme);
    styleCache.set(theme, style);
  }
  return style;
}
