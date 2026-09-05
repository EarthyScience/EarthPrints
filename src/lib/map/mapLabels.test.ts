import { describe, expect, it } from "vitest";
import type { StyleSpecification } from "maplibre-gl";
import {
  isDarkBasemapTextLayer,
  isPlaceLabelLayer,
  isPrimaryDarkBasemapTextLayer,
  patchDarkMapLabelStyle,
  SINGLE_LINE_LABEL_TEXT_FIELD,
} from "@/lib/map/mapLabels";

describe("isPlaceLabelLayer", () => {
  it("matches OpenFreeMap place label layers", () => {
    expect(isPlaceLabelLayer("place_city")).toBe(true);
    expect(isPlaceLabelLayer("place_country_major")).toBe(true);
  });

  it("ignores non-place symbol layers", () => {
    expect(isPlaceLabelLayer("highway_name_other")).toBe(false);
    expect(isPlaceLabelLayer("water_name")).toBe(false);
  });
});

describe("isDarkBasemapTextLayer", () => {
  it("includes place and water labels", () => {
    expect(isDarkBasemapTextLayer("place_city")).toBe(true);
    expect(isDarkBasemapTextLayer("water_name")).toBe(true);
  });

  it("ignores highway labels", () => {
    expect(isDarkBasemapTextLayer("highway_name_other")).toBe(false);
  });
});

describe("isPrimaryDarkBasemapTextLayer", () => {
  it("treats countries and large cities as primary", () => {
    expect(isPrimaryDarkBasemapTextLayer("place_country_major")).toBe(true);
    expect(isPrimaryDarkBasemapTextLayer("place_city_large")).toBe(true);
    expect(isPrimaryDarkBasemapTextLayer("water_name")).toBe(true);
  });

  it("treats states and smaller cities as secondary", () => {
    expect(isPrimaryDarkBasemapTextLayer("place_state")).toBe(false);
    expect(isPrimaryDarkBasemapTextLayer("place_city")).toBe(false);
  });
});

/**
 * `LayerSpecification` is a union, and only its symbol arm has the `text-*`
 * keys the assertions below read. Narrowing on `type` here keeps them free of
 * casts, and a layer that came back as something else fails loudly rather than
 * quietly returning undefined.
 */
function symbolLayerAt(style: StyleSpecification, index: number) {
  const layer = style.layers[index];
  if (layer?.type !== "symbol") {
    throw new Error(`Layer ${index} is ${layer?.type ?? "missing"}, not symbol`);
  }
  return layer;
}

describe("patchDarkMapLabelStyle", () => {
  it("brightens primary labels, defers secondary labels, and uses single-line text", () => {
    const style = patchDarkMapLabelStyle({
      version: 8,
      sources: {},
      layers: [
        {
          id: "place_country_major",
          type: "symbol",
          source: "openmaptiles",
          layout: {
            "text-field": [
              "concat",
              ["get", "name:latin"],
              "\n",
              ["get", "name:nonlatin"],
            ],
          },
          paint: {
            "text-color": "rgb(101,101,101)",
            "text-halo-color": "rgba(0,0,0,0.7)",
          },
        },
        {
          id: "place_state",
          type: "symbol",
          source: "openmaptiles",
          maxzoom: 12,
          layout: { "text-field": ["get", "name"] },
          paint: { "text-color": "rgb(101,101,101)" },
        },
        {
          id: "water_name",
          type: "symbol",
          source: "openmaptiles",
          layout: { "text-field": ["get", "name"] },
          paint: { "text-color": "hsla(0,0%,0%,0.7)" },
        },
        {
          id: "highway_name_other",
          type: "symbol",
          source: "openmaptiles",
          layout: { "text-field": ["get", "name"] },
          paint: { "text-color": "rgba(80, 78, 78, 1)" },
        },
      ],
    });

    const country = symbolLayerAt(style, 0);
    const state = symbolLayerAt(style, 1);
    const water = symbolLayerAt(style, 2);
    const highway = symbolLayerAt(style, 3);

    expect(country.layout?.["text-field"]).toEqual(SINGLE_LINE_LABEL_TEXT_FIELD);
    expect(country.paint?.["text-color"]).toBe("#ffffff");
    expect(country.paint?.["text-halo-color"]).toBe("rgba(0, 0, 0, 0.92)");
    expect(country.paint?.["text-halo-width"]).toBe(1.6);
    expect(state.minzoom).toBe(5);
    expect(state.paint?.["text-color"]).toBe("rgba(255, 255, 255, 0.9)");
    expect(water.paint?.["text-color"]).toBe("#ffffff");
    expect(highway.paint?.["text-color"]).toBe("rgba(80, 78, 78, 1)");
  });
});
