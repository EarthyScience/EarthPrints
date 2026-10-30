import { describe, expect, it } from "vitest";
import { canonicalizeChunk } from "@/lib/zarr/chunks";

describe("canonicalizeChunk", () => {
  it("reorders any axis order to [time, hour, lat, lon] and decodes packing", () => {
    // Stored as [lat=2, time=3, member=2, lon=2], row-major.
    const shape = [2, 3, 2, 2];
    const stride = [12, 4, 2, 1];
    const data = Int16Array.from({ length: 24 }, (_, i) => i);
    data[stride[0]! * 1 + stride[1]! * 2 + stride[2]! * 1 + 1] = -999;
    const out = canonicalizeChunk(
      data,
      shape,
      stride,
      { time: 1, hour: -1, lat: 0, lon: 3, fixed: [{ axis: 2, local: 1 }] },
      { localLatStart: 1, localLatCount: 1, localLonStart: 0, localLonCount: 2 },
      { scale: 0.5, offset: 10, fill: [-999] },
    );
    expect(out.shape).toEqual([3, 1, 1, 2]);
    const raw = (t: number, lon: number) => 12 + t * 4 + 2 + lon;
    expect(Array.from(out.data)).toEqual([
      raw(0, 0) * 0.5 + 10,
      raw(0, 1) * 0.5 + 10,
      raw(1, 0) * 0.5 + 10,
      raw(1, 1) * 0.5 + 10,
      raw(2, 0) * 0.5 + 10,
      NaN,
    ]);
  });
});
