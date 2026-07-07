import { describe, expect, it, vi } from "vitest";
import { createByteProgressSink } from "@/lib/zarr/store";

describe("createByteProgressSink", () => {
  it("reports running loaded/total as bytes arrive", () => {
    const onProgress = vi.fn();
    const sink = createByteProgressSink(onProgress);

    sink.addExpected(100);
    sink.addReceived(40);
    sink.addReceived(60);

    expect(onProgress.mock.calls).toEqual([
      [0, 100],
      [40, 100],
      [100, 100],
    ]);
  });

  it("grows the denominator as more requests announce their size", () => {
    const onProgress = vi.fn();
    const sink = createByteProgressSink(onProgress);

    sink.addExpected(100);
    sink.addReceived(50);
    sink.addExpected(100);

    expect(onProgress).toHaveBeenLastCalledWith(50, 200);
  });
});
