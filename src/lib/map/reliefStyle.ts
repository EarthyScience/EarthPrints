import type {
  ExpressionSpecification,
  LayerSpecification,
  SkySpecification,
  StyleSpecification,
} from "maplibre-gl";
import type { Theme } from "@/lib/theme";
import { SINGLE_LINE_LABEL_TEXT_FIELD } from "@/lib/map/mapLabels";

export const DEM_SOURCE_ID = "dem";
export const VECTOR_SOURCE_ID = "openmaptiles";

const MAPTERHORN_TILES = "https://tiles.mapterhorn.com/{z}/{x}/{y}.webp";
// Mapterhorn is global only up to z12; above that it has tiles for some
// regions and 404s elsewhere, which MapLibre draws as holes. Capping the
// source makes it overzoom z12 everywhere instead.
export const MAPTERHORN_MAX_ZOOM = 12;
// Pre-rendered relief for zoom 0-6 (scripts/relief-tiles). Bump the version
// whenever the palette or shading changes and upload the new archives.
const RELIEF_TILES_URL = process.env.NEXT_PUBLIC_RELIEF_TILES_URL;
const RELIEF_TILES_VERSION = 1;
export const PRERENDERED_SOURCE_ID = "relief-prerendered";
export const PRERENDERED_MAX_ZOOM = 6;
const PRERENDERED_FADE_MS = 300;

export function prerenderedReliefUrl(baseUrl: string, theme: Theme) {
  return `pmtiles://${baseUrl.replace(/\/$/, "")}/relief-${theme}-v${RELIEF_TILES_VERSION}.pmtiles`;
}

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
  exaggeration: number | ExpressionSpecification;
  boundary: string;
  road: string;
  roadMajor: string;
  building: string;
  label: string;
  labelHalo: string;
  waterLabel: string;
  sky: SkySpecification;
};

// Light is a monochrome "clay" globe: near-white land over a cool gray
// ocean, with the terrain carried by blue-gray shading rather than hue.
// Dark keeps Natural Earth style hypsometric tints in night tones.
export const RELIEF_PALETTES: Record<Theme, ReliefPalette> = {
  light: {
    elevation: [
      [-6000, "#c3c7d4"],
      [-200, "#d3d6e0"],
      [0, "#eceef3"],
      [500, "#f0f1f5"],
      [1500, "#f4f5f8"],
      [3000, "#f8f9fb"],
      [5000, "#ffffff"],
    ],
    ocean: "#d5d8e2",
    water: "#d1d5df",
    waterOpacity: 0.92,
    shadow: "rgba(84, 92, 124, 0.55)",
    highlight: "rgba(255, 255, 255, 0.9)",
    accent: "rgba(84, 92, 124, 0.28)",
    // Full strength at globe scale, where slopes are only a few pixels wide.
    exaggeration: ["interpolate", ["linear"], ["zoom"], 0, 1, 6, 0.7],
    boundary: "rgba(92, 98, 122, 0.3)",
    road: "rgba(92, 98, 122, 0.22)",
    roadMajor: "rgba(92, 98, 122, 0.38)",
    building: "rgba(92, 98, 122, 0.14)",
    label: "#4a4f5e",
    labelHalo: "rgba(246, 247, 250, 0.9)",
    waterLabel: "#7d8399",
    sky: {
      "sky-color": "#e9ebf1",
      "horizon-color": "#ffffff",
      "fog-color": "#f3f4f7",
      "sky-horizon-blend": 0.6,
      "horizon-fog-blend": 0.7,
      "fog-ground-blend": 0.4,
      "atmosphere-blend": [
        "interpolate",
        ["linear"],
        ["zoom"],
        0,
        1,
        5,
        1,
        7,
        0,
      ],
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
    exaggeration: 0.5,
    boundary: "rgba(210, 220, 230, 0.22)",
    road: "rgba(210, 220, 230, 0.16)",
    roadMajor: "rgba(210, 220, 230, 0.28)",
    building: "rgba(210, 220, 230, 0.1)",
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
      "atmosphere-blend": [
        "interpolate",
        ["linear"],
        ["zoom"],
        0,
        1,
        5,
        1,
        7,
        0,
      ],
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

// Each road tier fades in once it is dense enough to read, so the relief
// stays the subject at regional zoom.
const ROAD_TIERS = [
  { id: "road-major", classes: ["motorway", "trunk", "primary"], minzoom: 6 },
  { id: "road-mid", classes: ["secondary", "tertiary"], minzoom: 9 },
  { id: "road-minor", classes: ["minor", "service"], minzoom: 12 },
] as const;

function roadWidth(base: number): ExpressionSpecification {
  return [
    "interpolate",
    ["exponential", 1.5],
    ["zoom"],
    6,
    base * 0.3,
    12,
    base,
    18,
    base * 10,
  ];
}
const LABEL_FONT_BOLD = ["Noto Sans Bold"];

function buildStyle(
  theme: Theme,
  prerenderedBaseUrl?: string,
): StyleSpecification {
  const palette = RELIEF_PALETTES[theme];
  // With pre-rendered tiles, live relief only draws where they run out.
  const liveMinZoom = prerenderedBaseUrl ? PRERENDERED_MAX_ZOOM : 0;
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
        maxzoom: MAPTERHORN_MAX_ZOOM,
        attribution: MAPTERHORN_ATTRIBUTION,
      },
      [VECTOR_SOURCE_ID]: {
        type: "vector",
        url: OPENFREEMAP_TILEJSON,
      },
      ...(prerenderedBaseUrl && {
        [PRERENDERED_SOURCE_ID]: {
          type: "raster" as const,
          url: prerenderedReliefUrl(prerenderedBaseUrl, theme),
          tileSize: 512,
          attribution: MAPTERHORN_ATTRIBUTION,
        },
      }),
    },
    layers: [
      {
        id: "ocean",
        type: "background",
        paint: { "background-color": palette.ocean },
      },
      ...(prerenderedBaseUrl
        ? [
            {
              id: "relief-prerendered",
              type: "raster" as const,
              source: PRERENDERED_SOURCE_ID,
              paint: { "raster-fade-duration": PRERENDERED_FADE_MS },
            },
          ]
        : []),
      {
        id: "relief-tint",
        type: "color-relief",
        source: DEM_SOURCE_ID,
        minzoom: liveMinZoom,
        paint: { "color-relief-color": elevationRamp(palette.elevation) },
      },
      {
        id: "relief-shade",
        type: "hillshade",
        source: DEM_SOURCE_ID,
        minzoom: liveMinZoom,
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
          "hillshade-exaggeration": palette.exaggeration,
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
        id: "building",
        type: "fill",
        source: VECTOR_SOURCE_ID,
        "source-layer": "building",
        minzoom: 13,
        paint: {
          "fill-color": palette.building,
          "fill-opacity": ["interpolate", ["linear"], ["zoom"], 13, 0, 14, 1],
        },
      },
      ...[...ROAD_TIERS]
        .reverse()
        .map((tier, index, tiers): LayerSpecification => ({
          id: tier.id,
          type: "line",
          source: VECTOR_SOURCE_ID,
          "source-layer": "transportation",
          minzoom: tier.minzoom,
          filter: [
            "all",
            ["match", ["get", "class"], [...tier.classes], true, false],
            ["!=", ["get", "brunnel"], "tunnel"],
          ],
          layout: { "line-cap": "round", "line-join": "round" },
          paint: {
            "line-color":
              index === tiers.length - 1 ? palette.roadMajor : palette.road,
            "line-width": roadWidth(tiers.length - index),
            "line-opacity": [
              "interpolate",
              ["linear"],
              ["zoom"],
              tier.minzoom,
              0,
              tier.minzoom + 1,
              1,
            ],
          },
        })),
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
        filter: [
          "match",
          ["geometry-type"],
          ["MultiPoint", "Point"],
          true,
          false,
        ],
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
        minzoom: 3,
        filter: ["==", ["get", "class"], "city"],
        layout: {
          "text-field": SINGLE_LINE_LABEL_TEXT_FIELD,
          "text-font": LABEL_FONT,
          "text-size": [
            "interpolate",
            ["exponential", 1.2],
            ["zoom"],
            3,
            10,
            7,
            13,
            11,
            18,
          ],
          "text-max-width": 8,
          // Lower rank is a larger city, so it wins label collisions.
          "symbol-sort-key": ["get", "rank"],
        },
        paint: labelPaint,
      },
      {
        id: "label-town",
        type: "symbol",
        source: VECTOR_SOURCE_ID,
        "source-layer": "place",
        minzoom: 8,
        filter: ["==", ["get", "class"], "town"],
        layout: {
          "text-field": SINGLE_LINE_LABEL_TEXT_FIELD,
          "text-font": LABEL_FONT,
          "text-size": ["interpolate", ["linear"], ["zoom"], 8, 10, 12, 14],
          "text-max-width": 8,
          "symbol-sort-key": ["get", "rank"],
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
    style = buildStyle(theme, RELIEF_TILES_URL);
    styleCache.set(theme, style);
  }
  return style;
}

// The layers pre-rendered into raster tiles. Everything else stays live.
const BAKED_LAYER_IDS = new Set(["ocean", "relief-tint", "relief-shade"]);

export function buildBakedReliefStyle(theme: Theme): StyleSpecification {
  const style = buildStyle(theme);
  return {
    version: 8,
    sources: { [DEM_SOURCE_ID]: style.sources[DEM_SOURCE_ID] },
    layers: style.layers.filter((layer) => BAKED_LAYER_IDS.has(layer.id)),
  };
}
