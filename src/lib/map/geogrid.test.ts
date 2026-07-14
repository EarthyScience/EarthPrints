import { describe, expect, it } from "vitest";
import {
  chunkPatchBounds,
  geoPointToZarrGrid,
  gridCellToBounds,
  gridCellToGuidePaths,
  gridCellToPolygon,
  densifyLonLatPath,
  selectionGuideGeoJson,
} from "@/lib/map/geogrid";
import { ZARR_STORE } from "@/lib/constants/store";

describe("gridCellToBounds", () => {
  it("returns a 0.05° footprint centered on the snapped cell", () => {
    const cell = geoPointToZarrGrid({ lon: 10.012, lat: 51.998 });
    const bounds = gridCellToBounds(cell);

    expect(bounds.east - bounds.west).toBeCloseTo(
      ZARR_STORE.spatialResolutionDeg,
    );
    expect(bounds.north - bounds.south).toBeCloseTo(
      ZARR_STORE.spatialResolutionDeg,
    );
    expect(cell.lon).toBeCloseTo((bounds.west + bounds.east) / 2);
    expect(cell.lat).toBeCloseTo((bounds.south + bounds.north) / 2);
  });
});

describe("gridCellToPolygon", () => {
  it("returns a four-corner ring around the cell center", () => {
    const cell = geoPointToZarrGrid({ lon: 10.012, lat: 51.998 });
    const bounds = gridCellToBounds(cell);

    expect(gridCellToPolygon(cell)).toEqual([
      { lon: bounds.west, lat: bounds.north },
      { lon: bounds.east, lat: bounds.north },
      { lon: bounds.east, lat: bounds.south },
      { lon: bounds.west, lat: bounds.south },
    ]);
  });
});

describe("chunkPatchBounds", () => {
  it("spans the 40x40 native chunk that contains the cell", () => {
    const { lat, lon } = ZARR_STORE.nativeChunks;
    const cell = geoPointToZarrGrid({ lon: 10.012, lat: 51.998 });
    const bounds = chunkPatchBounds(cell, lat, lon);

    // 40 cells of 0.05° = 2° on each side.
    expect(bounds.east - bounds.west).toBeCloseTo(lon * ZARR_STORE.spatialResolutionDeg);
    expect(bounds.north - bounds.south).toBeCloseTo(lat * ZARR_STORE.spatialResolutionDeg);

    // The clicked cell sits inside the patch.
    const cellBounds = gridCellToBounds(cell);
    expect(bounds.west).toBeLessThanOrEqual(cellBounds.west);
    expect(bounds.east).toBeGreaterThanOrEqual(cellBounds.east);
    expect(bounds.south).toBeLessThanOrEqual(cellBounds.south);
    expect(bounds.north).toBeGreaterThanOrEqual(cellBounds.north);
  });
});

describe("gridCellToGuidePaths", () => {
  it("extends a line from each cell edge to the viewport border", () => {
    const cell = {
      west: 9.975,
      east: 10.025,
      south: 51.975,
      north: 52.025,
    };
    const viewport = {
      west: 9,
      east: 11,
      south: 51,
      north: 53,
    };

    expect(gridCellToGuidePaths(cell, viewport)).toEqual([
      [
        [10, 52.025],
        [10, 53],
      ],
      [
        [10, 51.975],
        [10, 51],
      ],
      [
        [10.025, 52],
        [11, 52],
      ],
      [
        [9.975, 52],
        [9, 52],
      ],
    ]);
  });
});

describe("densifyLonLatPath", () => {
  it("adds intermediate points along a meridian segment", () => {
    const path = densifyLonLatPath([
      [10, 0],
      [10, 6],
    ]);

    expect(path[0]).toEqual([10, 0]);
    expect(path).toContainEqual([10, 2]);
    expect(path).toContainEqual([10, 4]);
    expect(path[path.length - 1]).toEqual([10, 6]);
  });
});

describe("selectionGuideGeoJson", () => {
  it("builds guide and cell features from shared guide paths", () => {
    const cell = geoPointToZarrGrid({ lon: 10.012, lat: 51.998 });
    const viewport = { west: 9, east: 11, south: 51, north: 53 };
    const guidePaths = gridCellToGuidePaths(gridCellToBounds(cell), viewport);
    const geojson = selectionGuideGeoJson(cell, guidePaths);

    expect(geojson.features).toHaveLength(5);
    expect(geojson.features.filter((f) => f.properties.kind === "guide")).toHaveLength(4);
    expect(geojson.features.find((f) => f.properties.kind === "cell")).toBeDefined();
  });
});
