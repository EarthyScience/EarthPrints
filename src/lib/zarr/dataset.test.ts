import { describe, expect, it } from "vitest";
import { describeAxis, inferLayout, normalizeStoreUrl } from "@/lib/zarr/dataset";

describe("normalizeStoreUrl", () => {
  it("accepts links to metadata files and cloud URIs", () => {
    expect(normalizeStoreUrl("https://x.org/a.zarr/zarr.json")).toBe("https://x.org/a.zarr");
    expect(normalizeStoreUrl("https://x.org/a.zarr/.zmetadata ")).toBe("https://x.org/a.zarr");
    expect(normalizeStoreUrl("s3://bucket/path/a.zarr/")).toBe("https://bucket.s3.amazonaws.com/path/a.zarr");
    expect(normalizeStoreUrl("gs://bucket/a.zarr")).toBe("https://storage.googleapis.com/bucket/a.zarr");
  });
});

describe("inferLayout", () => {
  it("finds the roles by name in any order and keeps the rest as extras", () => {
    expect(inferLayout(["member", "time", "level", "latitude", "longitude"], [5, 10, 3, 4, 8])).toEqual({
      rank: 5, time: 1, hour: -1, lat: 3, lon: 4, extraAxes: [0, 2],
    });
    expect(inferLayout(["time", "hour", "lat", "lon"], [7670, 24, 3600, 7200])).toMatchObject({ hour: 1 });
  });

  it("refuses arrays without a time or a grid", () => {
    expect(inferLayout(["lat", "lon"], [3, 4])).toBeNull();
    expect(inferLayout(["x", "y", "band"], [3, 4, 5])).toBeNull();
  });
});

describe("describeAxis", () => {
  it("keeps the values only for an uneven axis", () => {
    expect(describeAxis(Float64Array.from([0, 1, 2, 3])).values).toBeNull();
    expect(describeAxis(Float64Array.from([0, 1, 3, 7])).values).not.toBeNull();
  });
});
