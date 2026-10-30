import { describe, expect, it } from "vitest";
import {
  listTimeChunkIndicesForRange,
  pixelToNativeChunkContext,
  stitchTimeSeriesForRange,
} from "@/lib/zarr/chunks";
import {
  availableYears,
  dayIndexToUTCDate,
  formatSelectedYearsLabel,
  setActiveTime,
  yearsToContiguousBlocks,
  yearsToDateRange,
  yearsToDayRange,
  yearToDateRange,
} from "@/lib/zarr/timeRange";

describe("yearsToDayRange", () => {
  it("defaults to the most recent year of data", () => {
    expect(yearsToDayRange(1, 7670)).toEqual([7305, 7670]);
  });

  it("clamps to the full archive when requested", () => {
    expect(yearsToDayRange(21, 7670)).toEqual([0, 7670]);
  });
});

describe("yearToDateRange and chunk mapping", () => {
  it("covers 2001 to 2021", () => {
    expect(availableYears()).toHaveLength(21);
    expect(availableYears()[0]).toBe(2001);
    expect(availableYears()[20]).toBe(2021);
  });

  it("correctly calculates day range for 2001 and 2021", () => {
    expect(yearToDateRange(2001)).toEqual([0, 365]);
    expect(yearToDateRange(2021)).toEqual([7305, 7670]);
  });

  it("calculates contiguous blocks and multi-year range slices", () => {
    expect(yearsToContiguousBlocks([2018, 2019, 2020])).toEqual([[2018, 2019, 2020]]);
    expect(yearsToContiguousBlocks([2002, 2003, 2005, 2007, 2008])).toEqual([
      [2002, 2003],
      [2005],
      [2007, 2008],
    ]);

    expect(yearsToDateRange([2001, 2002])).toEqual([0, 730]);
    expect(formatSelectedYearsLabel([2018, 2019, 2020])).toBe("2018–2020");
    expect(formatSelectedYearsLabel([2005, 2018, 2019, 2020])).toBe("2005, 2018–2020");
  });
});

describe("another store's time axis", () => {
  it("indexes days and years from that store's origin", () => {
    setActiveTime({ originMs: Date.UTC(1979, 0, 1), totalDays: 366 + 365, slotsPerDay: 4 });
    try {
      expect(availableYears()).toEqual([1979, 1980]);
      expect(yearToDateRange(1980)).toEqual([365, 731]);
      expect(dayIndexToUTCDate(365).toISOString().slice(0, 10)).toBe("1980-01-01");
    } finally {
      setActiveTime(null);
    }
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
