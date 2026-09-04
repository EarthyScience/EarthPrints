import { describe, expect, it } from "vitest";
import {
  chunkIndexToSlice,
  extractBlockFromNativeChunk,
  extractPixelFromNativeChunk,
  nativeChunkKey,
  neighborhoodBlock,
  pixelSeriesKey,
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

describe("pixelSeriesKey", () => {
  it("distinguishes pixels and time chunks", () => {
    expect(pixelSeriesKey("NEE", 50, 60, 2)).toBe("NEE:50:60:2");
    expect(pixelSeriesKey("NEE", 50, 60, 2)).not.toBe(
      pixelSeriesKey("NEE", 50, 61, 2),
    );
    expect(pixelSeriesKey("NEE", 50, 60, 2)).not.toBe(
      pixelSeriesKey("NEE", 50, 60, 3),
    );
  });
});

describe("neighborhoodBlock", () => {
  const shape = [4, 2, 40, 40];

  it("centres a square window on the pixel", () => {
    expect(neighborhoodBlock({ localLat: 10, localLon: 20 }, 2, shape)).toEqual({
      localLatStart: 8,
      localLatCount: 5,
      localLonStart: 18,
      localLonCount: 5,
    });
  });

  it("clamps at the low edge of the chunk", () => {
    expect(neighborhoodBlock({ localLat: 1, localLon: 0 }, 2, shape)).toEqual({
      localLatStart: 0,
      localLatCount: 4,
      localLonStart: 0,
      localLonCount: 3,
    });
  });

  it("clamps at the high edge of the chunk", () => {
    expect(neighborhoodBlock({ localLat: 39, localLon: 38 }, 2, shape)).toEqual({
      localLatStart: 37,
      localLatCount: 3,
      localLonStart: 36,
      localLonCount: 4,
    });
  });

  it("collapses to a single pixel at radius 0", () => {
    expect(neighborhoodBlock({ localLat: 5, localLon: 6 }, 0, shape)).toEqual({
      localLatStart: 5,
      localLatCount: 1,
      localLonStart: 6,
      localLonCount: 1,
    });
  });
});

describe("extractBlockFromNativeChunk", () => {
  const shape = [2, 2, 4, 4] as const;

  function makeData() {
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
    return data;
  }

  it("lays pixels out lat-major, each holding its whole series", () => {
    const block = {
      localLatStart: 1,
      localLatCount: 2,
      localLonStart: 2,
      localLonCount: 2,
    };
    const values = extractBlockFromNativeChunk(makeData(), shape, block);

    expect(values).toHaveLength(2 * 2 * 4);
    // (1,2), (1,3), (2,2), (2,3), each t0h0 t0h1 t1h0 t1h1.
    expect(Array.from(values)).toEqual([
      12, 112, 1012, 1112, 13, 113, 1013, 1113, 22, 122, 1022, 1122, 23, 123,
      1023, 1123,
    ]);
  });

  it("agrees with extractPixelFromNativeChunk for each pixel", () => {
    const data = makeData();
    const block = {
      localLatStart: 0,
      localLatCount: 2,
      localLonStart: 0,
      localLonCount: 2,
    };
    const values = extractBlockFromNativeChunk(data, shape, block);
    const seriesLength = shape[0] * shape[1];

    let offset = 0;
    for (let lat = 0; lat < block.localLatCount; lat++) {
      for (let lon = 0; lon < block.localLonCount; lon++) {
        expect(Array.from(values.subarray(offset, offset + seriesLength))).toEqual(
          Array.from(
            extractPixelFromNativeChunk(data, shape, {
              localLat: block.localLatStart + lat,
              localLon: block.localLonStart + lon,
            }),
          ),
        );
        offset += seriesLength;
      }
    }
  });
});
