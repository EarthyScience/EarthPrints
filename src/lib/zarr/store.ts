import * as zarr from "zarrita";
import { ZARR_STORE } from "@/lib/constants/store";
import type { AxisSlice } from "@/lib/zarr/chunks";
import type { GridCell } from "@/types/map";

export type ZarrStore = Awaited<ReturnType<typeof openZarrStore>>;

export type ZarrArrayHandle = {
  attrs: Record<string, unknown>;
  shape: number[];
  chunks: number[];
};

type ByteSink = {
  addExpected: (bytes: number) => void;
  addReceived: (bytes: number) => void;
};

/**
 * Accumulate downloaded / expected bytes and report the running totals. The
 * expected total grows as each request's `Content-Length` arrives, so the
 * denominator firms up over the first responses.
 */
export function createByteProgressSink(
  onProgress: (loaded: number, total: number) => void,
): ByteSink {
  let loaded = 0;
  let total = 0;
  return {
    addExpected(bytes) {
      total += bytes;
      onProgress(loaded, total);
    },
    addReceived(bytes) {
      loaded += bytes;
      onProgress(loaded, total);
    },
  };
}

// The FetchStore is created once, but progress is per request, so the active
// sink is swapped in around a fetch and cleared afterwards.
let activeByteSink: ByteSink | null = null;

export function setActiveByteSink(sink: ByteSink | null): void {
  activeByteSink = sink;
}

export function getActiveByteSink(): ByteSink | null {
  return activeByteSink;
}

/**
 * A `fetch` for zarrita's store that tees each chunk response through a
 * counting stream so callers can show real download progress. Anything it
 * can't measure (no body, no length, non-GET, errors) passes through
 * untouched, so data loading never depends on the instrumentation.
 */
async function progressFetch(request: Request): Promise<Response> {
  // Capture the sink synchronously, before the await, so this fetch binds to
  // the request that was active when it started even if another request swaps
  // the global sink in while we await the response.
  const sink = activeByteSink;
  const response = await fetch(request);
  const total = Number(response.headers.get("content-length"));

  if (
    !sink ||
    !response.ok ||
    !response.body ||
    request.method !== "GET" ||
    !Number.isFinite(total) ||
    total <= 0
  ) {
    return response;
  }

  try {
    const reader = response.body.getReader();
    sink.addExpected(total);
    const stream = new ReadableStream<Uint8Array>({
      async pull(controller) {
        const { done, value } = await reader.read();
        if (done) {
          controller.close();
          return;
        }
        sink.addReceived(value.byteLength);
        controller.enqueue(value);
      },
      cancel(reason) {
        return reader.cancel(reason);
      },
    });
    return new Response(stream, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  } catch {
    return response;
  }
}

export async function openZarrStore(url = ZARR_STORE.url) {
  const raw = new zarr.FetchStore(url, { fetch: progressFetch });
  const consolidated = await zarr.withConsolidatedMetadata(raw);
  const store = zarr.withByteCaching(consolidated);
  return {
    store,
    root: zarr.root(store),
  };
}

/** One pixel, time × hour slice, via zarrita's built-in slice assembly. */
export async function fetchPixelTimeSeries(
  array: ZarrArrayHandle,
  grid: GridCell,
  variable: string = ZARR_STORE.defaultVariable,
  timeRange?: AxisSlice,
): Promise<{ values: Float32Array; variable: string; units?: string }> {
  const timeSelection =
    timeRange === undefined
      ? null
      : zarr.slice(timeRange[0], timeRange[1]);

  const result = await zarr.get(array as Parameters<typeof zarr.get>[0], [
    timeSelection,
    null,
    grid.latIndex,
    grid.lonIndex,
  ]);
  const units =
    typeof array.attrs.units === "string" ? array.attrs.units : undefined;

  return {
    values: result.data as Float32Array,
    variable,
    units,
  };
}
