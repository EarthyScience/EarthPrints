import { describe, expect, it } from "vitest";
import {
  chunkIndexToSlice,
  extractPixelFromNativeChunk,
  nativeChunkKey,
  pixelToLocalOffset,
  pixelToNativeChunkContext,
  stitchTimeSeries,
} from "@/lib/zarr/chunks";

describe("chunk helpers", () => {
  it("builds native chunk cache keys", () => {
    expect(
      nativeChunkKey("NEE", {
        timeChunkIdx: 2,
        hourChunkIdx: 0,
        latChunkIdx: 1,
        lonChunkIdx: 3,
      }),
    ).toBe("NEE:2:0:1:3");
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

  it("lists native time-chunk indices for a pixel", () => {
    expect(
      pixelToNativeChunkContext(50, 50, 7670, {
        time: 1461,
        hour: 24,
        lat: 40,
        lon: 40,
      }),
    ).toEqual({
      chunkLatIdx: 1,
      chunkLonIdx: 1,
      localLat: 10,
      localLon: 10,
      timeChunkIndices: [0, 1, 2, 3, 4, 5],
    });
  });
});

describe("extractPixelFromNativeChunk", () => {
  it("pulls one pixel series out of a flattened native chunk", () => {
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

    const series = extractPixelFromNativeChunk(data, shape, {
      localLat: 1,
      localLon: 2,
    });

    expect(Array.from(series)).toEqual([12, 112, 1012, 1112]);
  });
});

describe("stitchTimeSeries", () => {
  it("concatenates native-chunk segments in order", () => {
    expect(
      Array.from(
        stitchTimeSeries([
          new Float32Array([1, 2]),
          new Float32Array([3, 4]),
        ]),
      ),
    ).toEqual([1, 2, 3, 4]);
  });
});
