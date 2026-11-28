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

// Swapped in alongside the sink so an abandoned request stops downloading
// instead of running to completion for a result nobody will read.
let activeAbortSignal: AbortSignal | null = null;

export function setActiveAbortSignal(signal: AbortSignal | null): void {
  activeAbortSignal = signal;
}

export function getActiveAbortSignal(): AbortSignal | null {
  return activeAbortSignal;
}

/**
 * Per-request progress and abort, for downloads that overlap. The swapped
 * globals above only work one request at a time; here the request carries a
 * tag that `progressFetch` resolves to its own sink and strips again before
 * the request leaves, so it never reaches the server or triggers a CORS
 * preflight.
 */
const REQUEST_TAG = "x-earthprints-request";
const taggedSinks = new Map<string, ByteSink | null>();
let nextTag = 0;

export async function withRequestContext<T>(
  sink: ByteSink | null,
  signal: AbortSignal | null,
  run: (init: RequestInit) => Promise<T>,
): Promise<T> {
  const tag = String(++nextTag);
  taggedSinks.set(tag, sink);
  try {
    return await run({
      headers: { [REQUEST_TAG]: tag },
      ...(signal ? { signal } : {}),
    });
  } finally {
    taggedSinks.delete(tag);
  }
}

/** The rejection used when a caller abandons a decode. */
export function abortError(): Error {
  const error = new Error("Chunk decode aborted");
  error.name = "AbortError";
  return error;
}

/** True when the error is a fetch abort rather than a real failure. */
export function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

/**
 * Attempts per request, the first included. A picked coordinate fans out into
 * one request per native chunk, and a single flaky one fails the whole series,
 * so a transient error is retried here rather than bubbling up as "could not
 * load" for the user to click through again.
 */
const FETCH_ATTEMPTS = 3;

/** Doubles per retry: 400ms, then 800ms. */
const RETRY_BASE_DELAY_MS = 400;

/**
 * Statuses worth a second look. 404 is deliberately absent: zarrita reads it as
 * a missing chunk, which is a legitimate answer rather than a failure.
 */
function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const lastAnswerByOrigin = new Map<string, number>();

function originOf(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

/** When the host serving `url` last answered a request, in ms since epoch. */
export function lastAnswerFrom(url: string): number {
  const origin = originOf(url);
  return (origin && lastAnswerByOrigin.get(origin)) || 0;
}

/**
 * `fetch` with a couple of retries for the errors that clear on their own:
 * dropped connections, and the throttling and gateway statuses the store
 * would otherwise throw on.
 */
export async function fetchWithRetry(request: Request): Promise<Response> {
  for (let attempt = 1; ; attempt += 1) {
    const last = attempt === FETCH_ATTEMPTS;

    try {
      // A Request can only be sent once, so each attempt gets its own copy.
      const response = await fetch(last ? request : request.clone());
      const origin = originOf(request.url);
      if (origin) lastAnswerByOrigin.set(origin, Date.now());
      if (last || !isRetryableStatus(response.status)) return response;
      // Nothing will read this body; release the connection before retrying.
      await response.body?.cancel();
    } catch (error) {
      // An abort is the caller's decision, not a transient failure.
      if (last || request.signal?.aborted) throw error;
    }

    await delay(RETRY_BASE_DELAY_MS * 2 ** (attempt - 1));
  }
}

/**
 * A `fetch` for zarrita's store that tees each chunk response through a
 * counting stream so callers can show real download progress. Anything it
 * can't measure (no body, no length, non-GET, errors) passes through
 * untouched, so data loading never depends on the instrumentation.
 */
async function progressFetch(request: Request): Promise<Response> {
  const tag = request.headers.get(REQUEST_TAG);
  if (tag !== null) {
    const headers = new Headers(request.headers);
    headers.delete(REQUEST_TAG);
    request = new Request(request, { headers });
  }
  // Capture the sink synchronously, before the await, so this fetch binds to
  // the request that was active when it started even if another request swaps
  // the global sink in while we await the response.
  const sink = tag !== null ? (taggedSinks.get(tag) ?? null) : activeByteSink;
  // Bind the signal onto the Request so fetchWithRetry's clones keep it and
  // its own aborted check sees it.
  const signal = tag !== null ? null : activeAbortSignal;
  const response = await fetchWithRetry(
    signal ? new Request(request, { signal }) : request,
  );
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

/**
 * Cache metadata documents only. Chunk bodies are hundreds of MB each and are
 * fetched exactly once per pixel neighbourhood by the decode worker, so
 * retaining their compressed bytes buys nothing and previously grew without
 * bound (the default policy caches every request into an unbounded Map).
 */
export function metadataOnlyKey(
  path: `/${string}`,
  range?: unknown,
): string | undefined {
  if (range !== undefined) return undefined;
  return /\/(zarr\.json|\.zarray|\.zattrs|\.zgroup)$/.test(path)
    ? path
    : undefined;
}

export async function openZarrStore(url: string = ZARR_STORE.url) {
  const raw = new zarr.FetchStore(url, { fetch: progressFetch });
  // Stores without consolidated metadata still open; they just cannot list
  // their arrays.
  // Asking for the format up front saves a v3 store the round of v2 probes
  // (.zmetadata, .zgroup, .zarray) that each log a 404 in the console.
  const isV3 = (await raw.get("/zarr.json")) !== undefined;
  const consolidated = await zarr.withMaybeConsolidatedMetadata(raw, {
    format: isV3 ? "v3" : "v2",
  });
  const store = zarr.withByteCaching(consolidated, { keyFor: metadataOnlyKey });
  return {
    store,
    root: zarr.root(store),
    // The decode worker opens its own store against the same dataset.
    url,
    version: (isV3 ? "v3" : "v2") as "v2" | "v3",
  };
}

type VersionedRoot<S extends zarr.Readable> = {
  root: zarr.Location<S>;
  version: "v2" | "v3";
};

/**
 * Open nodes in the store's own format. Left to guess, zarrita probes the
 * other format first and each miss logs a 404 in the console.
 */
export function openArrayNode<S extends zarr.Readable>(
  ds: VersionedRoot<S>,
  path: string,
) {
  const location = ds.root.resolve(path);
  return ds.version === "v3"
    ? zarr.open.v3(location, { kind: "array" })
    : zarr.open.v2(location, { kind: "array" });
}

export function openRootNode<S extends zarr.Readable>(ds: VersionedRoot<S>) {
  return ds.version === "v3" ? zarr.open.v3(ds.root) : zarr.open.v2(ds.root);
}

/**
 * Aggregate byte progress across the several native chunks one time series
 * needs. Chunks download one at a time, so the denominator is extrapolated
 * from the chunks already finished (they are near-identical in size), which
 * keeps the bar moving forward instead of resetting per chunk.
 */
export function createSeriesProgressTracker(
  chunkCount: number,
  onProgress: (loaded: number, total: number) => void,
) {
  let completedBytes = 0;
  let completedChunks = 0;
  let inflightLoaded = 0;
  let inflightTotal = 0;
  let inflight = false;

  function emit() {
    const perChunk =
      completedChunks > 0 ? completedBytes / completedChunks : inflightTotal;
    // Only subtract a slot for the in-flight chunk while one is actually
    // running, or the estimate dips every time a chunk lands.
    const pending = Math.max(
      0,
      chunkCount - completedChunks - (inflight ? 1 : 0),
    );
    const loaded = completedBytes + inflightLoaded;
    const total = completedBytes + inflightTotal + perChunk * pending;
    // A response without a Content-Length contributes bytes but no total.
    onProgress(loaded, Math.max(loaded, total));
  }

  return {
    /** Latest byte counts for the chunk currently downloading. */
    update(loaded: number, total: number) {
      inflight = true;
      inflightLoaded = loaded;
      inflightTotal = total;
      emit();
    },
    /** The in-flight chunk finished; fold its bytes into the completed total. */
    complete() {
      completedBytes += Math.max(inflightTotal, inflightLoaded);
      completedChunks += 1;
      inflightLoaded = 0;
      inflightTotal = 0;
      inflight = false;
      emit();
    },
  };
}

export type SeriesProgressTracker = ReturnType<
  typeof createSeriesProgressTracker
>;

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

/**
 * Byte progress for chunks downloading side by side. Chunks not yet started
 * are estimated at the average size of the finished ones.
 */
export function createConcurrentProgressTracker(
  chunkCount: number,
  onProgress: (loaded: number, total: number) => void,
) {
  const inflight = new Map<number, { loaded: number; total: number }>();
  let completedBytes = 0;
  let completedChunks = 0;
  let nextId = 0;

  function emit() {
    let loaded = completedBytes;
    let known = completedBytes;
    let sizes = 0;
    for (const bytes of inflight.values()) {
      loaded += bytes.loaded;
      known += Math.max(bytes.total, bytes.loaded);
      if (bytes.total > 0) sizes += 1;
    }
    const average =
      completedChunks > 0
        ? completedBytes / completedChunks
        : sizes > 0
          ? (known - completedBytes) / sizes
          : 0;
    const pending = Math.max(0, chunkCount - completedChunks - inflight.size);
    onProgress(loaded, Math.max(loaded, known + average * pending));
  }

  return {
    /** A tracker for one chunk, shaped like `createSeriesProgressTracker`'s. */
    start(): SeriesProgressTracker {
      const id = nextId++;
      inflight.set(id, { loaded: 0, total: 0 });
      return {
        update(loaded: number, total: number) {
          inflight.set(id, { loaded, total });
          emit();
        },
        complete() {
          const bytes = inflight.get(id);
          inflight.delete(id);
          completedBytes += bytes ? Math.max(bytes.total, bytes.loaded) : 0;
          completedChunks += 1;
          emit();
        },
      };
    },
  };
}
