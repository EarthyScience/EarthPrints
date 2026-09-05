/// <reference lib="webworker" />
import * as zarr from "zarrita";
import {
  extractBlockFromNativeChunk,
  neighborhoodBlock,
  type LocalBlock,
} from "@/lib/zarr/chunks";
import {
  createByteProgressSink,
  isAbortError,
  openZarrStore,
  setActiveAbortSignal,
  setActiveByteSink,
  type ZarrStore,
} from "@/lib/zarr/store";

/**
 * Decodes native Zarr chunks off the main thread.
 *
 * One chunk of this dataset is 1461 x 24 x 40 x 40 f4, so decompressing it
 * allocates ~224 MB. Doing that on the main thread froze the tab for seconds
 * at a time and killed it outright on phones. Here the big array is allocated,
 * read, and dropped inside the worker; only the requested pixel neighbourhood
 * (a few MB) is transferred back, so the main-thread heap never sees it.
 *
 * Requests are queued and served one at a time, which also caps process-wide
 * peak memory at a single decoded chunk no matter how many pixels are pending.
 */

export type ChunkRequest = {
  type: "decode";
  id: number;
  storeUrl: string;
  variable: string;
  chunkCoords: number[];
  localLat: number;
  localLon: number;
  radius: number;
};

/** Abandon a decode: drop it if queued, abort its download if running. */
export type CancelRequest = {
  type: "cancel";
  id: number;
};

export type WorkerMessage = ChunkRequest | CancelRequest;

export type ChunkResponse =
  | { id: number; type: "progress"; loaded: number; total: number }
  | {
      id: number;
      type: "result";
      block: LocalBlock;
      seriesLength: number;
      values: Float32Array;
    }
  | { id: number; type: "error"; message: string };

type ZarrArray = {
  getChunk(
    chunkCoords: number[],
  ): Promise<{ data: Float32Array; shape: number[] }>;
};

const scope = self as unknown as DedicatedWorkerGlobalScope;

let storePromise: Promise<ZarrStore> | null = null;
const arrayPromises = new Map<string, Promise<ZarrArray>>();
// Serialises decoding so only one chunk is ever resident.
let queue: Promise<unknown> = Promise.resolve();
// Abort handles for decodes that are running, and ids cancelled before their
// turn in the queue came up.
const running = new Map<number, AbortController>();
const cancelledBeforeStart = new Set<number>();

function getStore(url: string): Promise<ZarrStore> {
  if (!storePromise) {
    storePromise = openZarrStore(url).catch((error) => {
      storePromise = null;
      throw error;
    });
  }
  return storePromise;
}

function getArray(url: string, variable: string): Promise<ZarrArray> {
  const existing = arrayPromises.get(variable);
  if (existing) return existing;

  const promise = getStore(url)
    .then((ds) => zarr.open(ds.root.resolve(variable), { kind: "array" }))
    .then((array) => array as unknown as ZarrArray)
    .catch((error) => {
      arrayPromises.delete(variable);
      throw error;
    });

  arrayPromises.set(variable, promise);
  return promise;
}

async function handle(request: ChunkRequest): Promise<void> {
  // Cancelled while it sat in the queue: never start it.
  if (cancelledBeforeStart.delete(request.id)) return;

  const controller = new AbortController();
  running.set(request.id, controller);

  try {
    const array = await getArray(request.storeUrl, request.variable);
    const sink = createByteProgressSink((loaded, total) => {
      scope.postMessage({
        id: request.id,
        type: "progress",
        loaded,
        total,
      } satisfies ChunkResponse);
    });

    setActiveByteSink(sink);
    setActiveAbortSignal(controller.signal);
    let chunk: { data: Float32Array; shape: number[] };
    try {
      chunk = await array.getChunk(request.chunkCoords);
    } finally {
      setActiveByteSink(null);
      setActiveAbortSignal(null);
    }

    const block = neighborhoodBlock(
      { localLat: request.localLat, localLon: request.localLon },
      request.radius,
      chunk.shape,
    );
    const values = extractBlockFromNativeChunk(chunk.data, chunk.shape, block);
    const seriesLength = chunk.shape[0]! * chunk.shape[1]!;

    scope.postMessage(
      {
        id: request.id,
        type: "result",
        block,
        seriesLength,
        values,
      } satisfies ChunkResponse,
      [values.buffer],
    );
  } catch (error) {
    // The caller that aborted has already settled its own promise; there is
    // nobody left to tell.
    if (isAbortError(error)) return;
    scope.postMessage({
      id: request.id,
      type: "error",
      message: error instanceof Error ? error.message : String(error),
    } satisfies ChunkResponse);
  } finally {
    running.delete(request.id);
  }
}

scope.onmessage = (event: MessageEvent<WorkerMessage>) => {
  const message = event.data;

  if (message.type === "cancel") {
    const controller = running.get(message.id);
    if (controller) {
      controller.abort();
      running.delete(message.id);
    } else {
      cancelledBeforeStart.add(message.id);
    }
    return;
  }

  queue = queue.then(() => handle(message));
};
