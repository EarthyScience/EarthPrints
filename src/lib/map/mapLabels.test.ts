import { describe, expect, it } from "vitest";
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

    const l0 = style.layers?.[0] as unknown as { layout?: Record<string, unknown>; paint?: Record<string, unknown> };
    const l1 = style.layers?.[1] as unknown as { minzoom?: number; paint?: Record<string, unknown> };
    const l2 = style.layers?.[2] as unknown as { paint?: Record<string, unknown> };
    const l3 = style.layers?.[3] as unknown as { paint?: Record<string, unknown> };

    expect(l0?.layout?.["text-field"]).toEqual(
      SINGLE_LINE_LABEL_TEXT_FIELD,
    );
    expect(l0?.paint?.["text-color"]).toBe("#ffffff");
    expect(l0?.paint?.["text-halo-color"]).toBe(
      "rgba(0, 0, 0, 0.92)",
    );
    expect(l0?.paint?.["text-halo-width"]).toBe(1.6);
    expect(l1?.minzoom).toBe(5);
    expect(l1?.paint?.["text-color"]).toBe(
      "rgba(255, 255, 255, 0.9)",
    );
    expect(l2?.paint?.["text-color"]).toBe("#ffffff");
    expect(l3?.paint?.["text-color"]).toBe("rgba(80, 78, 78, 1)");
  });
});
