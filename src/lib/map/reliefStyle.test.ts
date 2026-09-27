import { describe, expect, it } from "vitest";
import { validateStyleMin } from "@maplibre/maplibre-gl-style-spec";
import {
  buildReliefStyle,
  DEM_SOURCE_ID,
  RELIEF_PALETTES,
} from "@/lib/map/reliefStyle";

const THEMES = ["light", "dark"] as const;

describe("buildReliefStyle", () => {
  it.each(THEMES)("produces a valid %s style", (theme) => {
    expect(validateStyleMin(buildReliefStyle(theme))).toEqual([]);
  });

  it("reads Mapterhorn as terrarium-encoded elevation", () => {
    const dem = buildReliefStyle("light").sources[DEM_SOURCE_ID];
    expect(dem).toMatchObject({ type: "raster-dem", encoding: "terrarium" });
  });

  it("draws tint and shading from the elevation source", () => {
    const layers = buildReliefStyle("light").layers;
    const relief = layers.filter(
      (layer) => layer.type === "color-relief" || layer.type === "hillshade",
    );
    expect(relief.map((layer) => layer.type)).toEqual([
      "color-relief",
      "hillshade",
    ]);
    for (const layer of relief) {
      expect("source" in layer && layer.source).toBe(DEM_SOURCE_ID);
    }
  });

  it("keeps labels above the relief", () => {
    const types = buildReliefStyle("dark").layers.map((layer) => layer.type);
    expect(types.lastIndexOf("hillshade")).toBeLessThan(types.indexOf("symbol"));
  });

  it("caches one style per theme", () => {
    expect(buildReliefStyle("dark")).toBe(buildReliefStyle("dark"));
    expect(buildReliefStyle("dark")).not.toBe(buildReliefStyle("light"));
  });

  it("gives light and dark different palettes", () => {
    expect(RELIEF_PALETTES.light.ocean).not.toBe(RELIEF_PALETTES.dark.ocean);
    expect(RELIEF_PALETTES.light.elevation).not.toEqual(
      RELIEF_PALETTES.dark.elevation,
    );
  });
});
