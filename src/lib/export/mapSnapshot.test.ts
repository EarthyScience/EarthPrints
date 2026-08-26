import { describe, expect, it } from "vitest";
import { collectAttribution, plainText } from "@/lib/export/mapSnapshot";

const FALLBACK = "OpenFreeMap, OpenMapTiles, OpenStreetMap contributors";

describe("plainText", () => {
  it("strips the anchors style attributions ship as", () => {
    expect(
      plainText('<a href="https://osm.org" target="_blank">OpenStreetMap</a>'),
    ).toBe("OpenStreetMap");
  });

  it("decodes the entities that survive stripping", () => {
    expect(plainText("Tiles&nbsp;&amp;&nbsp;data")).toBe("Tiles & data");
  });
});

describe("collectAttribution", () => {
  it("falls back when the style has not loaded", () => {
    expect(collectAttribution(undefined)).toBe(FALLBACK);
  });

  it("falls back when no source carries a credit", () => {
    expect(
      collectAttribution({
        blank: { type: "vector", tiles: [] },
      } as never),
    ).toBe(FALLBACK);
  });

  it("joins credits from every source that has one", () => {
    const result = collectAttribution({
      base: { type: "vector", attribution: "<a href='#'>OpenFreeMap</a>" },
      terrain: { type: "raster", attribution: "OpenMapTiles" },
    } as never);

    expect(result).toBe("OpenFreeMap, OpenMapTiles");
  });

  it("credits a shared provider once when sources repeat it", () => {
    const result = collectAttribution({
      base: { type: "vector", attribution: "OpenStreetMap contributors" },
      labels: { type: "vector", attribution: "OpenStreetMap contributors" },
    } as never);

    expect(result).toBe("OpenStreetMap contributors");
  });
});
