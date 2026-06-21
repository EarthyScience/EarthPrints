import { describe, expect, it } from "vitest";
import {
  listTimeChunkIndicesForRange,
  pixelToNativeChunkContext,
  stitchTimeSeriesForRange,
} from "@/lib/zarr/chunks";
import { yearsToDayRange } from "@/lib/zarr/timeRange";

describe("yearsToDayRange", () => {
  it("defaults to the most recent year of data", () => {
    expect(yearsToDayRange(1, 7670)).toEqual([7305, 7670]);
  });

  it("clamps to the full archive when requested", () => {
    expect(yearsToDayRange(21, 7670)).toEqual([0, 7670]);
  });
});

describe("listTimeChunkIndicesForRange", () => {
  it("returns only chunks overlapping the last year", () => {
    expect(listTimeChunkIndicesForRange([7305, 7670], 1461, 7670)).toEqual([5]);
  });

  it("returns all chunks for the full archive", () => {
    expect(listTimeChunkIndicesForRange([0, 7670], 1461, 7670)).toEqual([
      0, 1, 2, 3, 4, 5,
    ]);
  });
});

describe("pixelToNativeChunkContext with range", () => {
  it("limits native chunk indices to the requested window", () => {
    expect(
      pixelToNativeChunkContext(50, 50, 7670, {
        time: 1461,
        hour: 24,
        lat: 40,
        lon: 40,
      }, [7305, 7670]),
    ).toEqual({
      chunkLatIdx: 1,
      chunkLonIdx: 1,
      localLat: 10,
      localLon: 10,
      timeChunkIndices: [5],
    });
  });
});

describe("stitchTimeSeriesForRange", () => {
  it("trims partial overlap at chunk boundaries", () => {
    const stitched = stitchTimeSeriesForRange(
      [
        {
          chunkStartDay: 7305,
          values: new Float32Array([1, 2, 3, 4, 5, 6]),
        },
      ],
      [7306, 7307],
      2,
    );

    expect(Array.from(stitched)).toEqual([3, 4]);
  });
});
