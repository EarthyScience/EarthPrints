import { describe, expect, it } from "vitest";
import {
  chunkIndexToSlice,
  extractTimeSeries,
  pixelToChunkKey,
  pixelToLocalOffset,
  spatialChunkToSlices,
} from "@/lib/zarr/chunks";

describe("chunk helpers", () => {
  it("maps pixels in the same spatial chunk to the same key", () => {
    const keyA = pixelToChunkKey("NEE", 50, 50, 40, 40);
    const keyB = pixelToChunkKey("NEE", 51, 51, 40, 40);

    expect(keyA).toBe("NEE:1:1");
    expect(keyB).toBe(keyA);
  });

  it("computes local offsets inside a chunk", () => {
    expect(pixelToLocalOffset(50, 50, 40, 40)).toEqual({
      localLat: 10,
      localLon: 10,
    });
    expect(pixelToLocalOffset(51, 52, 40, 40)).toEqual({
      localLat: 11,
      localLon: 12,
    });
  });

  it("clamps the last chunk slice to the axis length", () => {
    expect(chunkIndexToSlice(89, 40, 3600)).toEqual([3560, 3600]);
  });

  it("builds lat/lon slice ranges for a spatial chunk", () => {
    expect(spatialChunkToSlices(1, 2, 40, 40, 3600, 7200)).toEqual({
      latSlice: [40, 80],
      lonSlice: [80, 120],
    });
  });
});

describe("extractTimeSeries", () => {
  it("pulls one pixel series out of a flattened 4D chunk", () => {
    const shape = [2, 2, 4, 4] as const;
    const [timeCount, hourCount, latCount, lonCount] = shape;
    const data = new Float32Array(timeCount * hourCount * latCount * lonCount);

    for (let t = 0; t < timeCount; t++) {
      for (let h = 0; h < hourCount; h++) {
        for (let lat = 0; lat < latCount; lat++) {
          for (let lon = 0; lon < lonCount; lon++) {
            const index =
              ((t * hourCount + h) * latCount + lat) * lonCount + lon;
            data[index] = t * 1000 + h * 100 + lat * 10 + lon;
          }
        }
      }
    }

    const series = extractTimeSeries(data, shape, {
      localLat: 1,
      localLon: 2,
    });

    expect(Array.from(series)).toEqual([12, 112, 1012, 1112]);
  });
});
