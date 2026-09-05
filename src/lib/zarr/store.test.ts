import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createByteProgressSink,
  createSeriesProgressTracker,
  fetchWithRetry,
  metadataOnlyKey,
} from "@/lib/zarr/store";

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

describe("fetchWithRetry", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  /**
   * Drive the backoff sleeps so the whole retry sequence runs in one tick.
   * Both are awaited together so a rejection is never momentarily unhandled,
   * which the runner reports as a failure of its own.
   */
  async function settle(pending: Promise<Response>): Promise<Response> {
    const [response] = await Promise.all([
      pending,
      vi.advanceTimersByTimeAsync(5_000),
    ]);
    return response;
  }

  function stubFetch(...responses: (Response | Error)[]) {
    const fetchMock = vi.fn(async () => {
      const next = responses.shift();
      if (next instanceof Error) throw next;
      return next ?? new Response(null, { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  it("retries a gateway error and returns the response that lands", async () => {
    const fetchMock = stubFetch(
      new Response("busy", { status: 503 }),
      new Response("chunk", { status: 200 }),
    );

    const response = await settle(
      fetchWithRetry(new Request("https://example.com/c/0/0")),
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(await response.text()).toBe("chunk");
  });

  it("retries a dropped connection", async () => {
    const fetchMock = stubFetch(
      new TypeError("Failed to fetch"),
      new Response("chunk", { status: 200 }),
    );

    const response = await settle(
      fetchWithRetry(new Request("https://example.com/c/0/0")),
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(response.status).toBe(200);
  });

  it("gives up after three attempts and hands back the last response", async () => {
    const fetchMock = stubFetch(
      new Response(null, { status: 500 }),
      new Response(null, { status: 500 }),
      new Response(null, { status: 500 }),
    );

    const response = await settle(
      fetchWithRetry(new Request("https://example.com/c/0/0")),
    );

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(response.status).toBe(500);
  });

  it("rethrows when every attempt throws", async () => {
    const fetchMock = stubFetch(
      new TypeError("Failed to fetch"),
      new TypeError("Failed to fetch"),
      new TypeError("Failed to fetch"),
    );

    await expect(
      settle(fetchWithRetry(new Request("https://example.com/c/0/0"))),
    ).rejects.toThrow("Failed to fetch");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  // zarrita reads a 404 as a missing chunk, so retrying one only delays a
  // legitimate answer.
  it("passes a 404 straight back", async () => {
    const fetchMock = stubFetch(new Response(null, { status: 404 }));

    const response = await settle(
      fetchWithRetry(new Request("https://example.com/c/9/9")),
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(404);
  });

  it("does not retry a request the caller aborted", async () => {
    const controller = new AbortController();
    const request = new Request("https://example.com/c/0/0", {
      signal: controller.signal,
    });
    const fetchMock = vi.fn(async () => {
      controller.abort();
      throw new Error("Aborted");
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(settle(fetchWithRetry(request))).rejects.toThrow("Aborted");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("metadataOnlyKey", () => {
  it("caches whole-object reads of metadata documents", () => {
    expect(metadataOnlyKey("/NEE/zarr.json")).toBe("/NEE/zarr.json");
    expect(metadataOnlyKey("/NEE/.zarray")).toBe("/NEE/.zarray");
    expect(metadataOnlyKey("/NEE/.zattrs")).toBe("/NEE/.zattrs");
    expect(metadataOnlyKey("/.zgroup")).toBe("/.zgroup");
  });

  it("skips chunk bodies, which are hundreds of MB each", () => {
    expect(metadataOnlyKey("/NEE/0.0.18.97")).toBeUndefined();
    expect(metadataOnlyKey("/NEE/c/0/0/18/97")).toBeUndefined();
  });

  it("skips range reads entirely", () => {
    expect(
      metadataOnlyKey("/NEE/zarr.json", { offset: 0, length: 10 }),
    ).toBeUndefined();
  });
});

describe("createSeriesProgressTracker", () => {
  it("extrapolates the total from the chunks already finished", () => {
    const onProgress = vi.fn();
    const tracker = createSeriesProgressTracker(3, onProgress);

    // The in-flight chunk's own size seeds the estimate for the other two,
    // so the denominator is right from the first update rather than growing.
    tracker.update(0, 100);
    expect(onProgress).toHaveBeenLastCalledWith(0, 300);
    tracker.update(50, 100);
    expect(onProgress).toHaveBeenLastCalledWith(50, 300);
    tracker.complete();

    // The total must not dip once a chunk lands and none is yet in flight.
    expect(onProgress).toHaveBeenLastCalledWith(100, 300);

    tracker.update(40, 100);
    expect(onProgress).toHaveBeenLastCalledWith(140, 300);
    tracker.complete();
    expect(onProgress).toHaveBeenLastCalledWith(200, 300);

    tracker.update(100, 100);
    tracker.complete();
    expect(onProgress).toHaveBeenLastCalledWith(300, 300);
  });

  it("never reports more loaded than total", () => {
    const seen: Array<[number, number]> = [];
    const tracker = createSeriesProgressTracker(4, (loaded, total) => {
      seen.push([loaded, total]);
    });

    for (let chunk = 0; chunk < 4; chunk++) {
      tracker.update(0, 80);
      tracker.update(80, 80);
      tracker.complete();
    }

    for (const [loaded, total] of seen) {
      expect(loaded).toBeLessThanOrEqual(total);
    }
  });

  it("counts a chunk whose length header never arrived", () => {
    const onProgress = vi.fn();
    const tracker = createSeriesProgressTracker(1, onProgress);

    tracker.update(120, 0);
    tracker.complete();

    expect(onProgress).toHaveBeenLastCalledWith(120, 120);
  });
});
