import type { MapViewState } from "@/types/map";

export const DEFAULT_MAP_VIEW: MapViewState = {
  longitude: 10,
  latitude: 30,
  zoom: 1.4,
  bearing: 0,
  pitch: 0,
};

export const MAP_BASE_STYLES = {
  dark: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
  light: "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json",
} as const;
