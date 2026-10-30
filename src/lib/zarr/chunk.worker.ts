/// <reference lib="webworker" />
import * as zarr from "zarrita";
import type { LocalBlock } from "@/lib/zarr/chunks";
import { readPatch, type ChunkSource, type PatchRequest } from "@/lib/zarr/patch";
import {
  createByteProgressSink,
  isAbortError,
  openZarrStore,
  withRequestContext,
  type ZarrStore,
} from "@/lib/zarr/store";

/**
 * Decodes native Zarr chunks off the main thread.
 *
 * One FLUXCOM-X chunk is 1461 x 24 x 40 x 40 f4, so decompressing it
 * allocates ~224 MB. Doing that on the main thread froze the tab for seconds
 * at a time and killed it outright on phones. Here it is decompressed off the
 * main thread, and the window the caller asked to keep is cut out and decoded
 * to Float32 before the handover, so the raw chunk is dropped here and never
 * reaches the main thread's heap.
 *
 * Requests are queued and served one at a time, which caps the memory held
 * during decoding at a single chunk no matter how many pixels are pending.
 * Small chunks skip the queue: they are bound by latency, not memory.
 */

export type ChunkRequest = PatchRequest & {
  type: "decode";
  id: number;
  storeUrl: string;
  variable: string;
  /** Small enough to skip the one-at-a-time queue. */
  concurrent?: boolean;
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
      data: Float32Array;
      /** Shape of what is returned: the chunk, or the window cut out of it. */
      shape: number[];
      /** Where that window sits in the chunk, for rebasing pixel offsets. */
      block: LocalBlock;
    }
  | { id: number; type: "error"; message: string };

const scope = self as unknown as DedicatedWorkerGlobalScope;

const storePromises = new Map<string, Promise<ZarrStore>>();
const arrayPromises = new Map<string, Promise<ChunkSource>>();
// Serialises decoding so only one chunk is ever resident.
let queue: Promise<unknown> = Promise.resolve();
// Abort handles for decodes that are running, and ids cancelled before their
// turn in the queue came up.
const running = new Map<number, AbortController>();
const cancelledBeforeStart = new Set<number>();

function getStore(url: string): Promise<ZarrStore> {
  let promise = storePromises.get(url);
  if (!promise) {
    promise = openZarrStore(url).catch((error) => {
      storePromises.delete(url);
      throw error;
    });
    storePromises.set(url, promise);
  }
  return promise;
}

function getArray(url: string, variable: string): Promise<ChunkSource> {
  const key = `${url}|${variable}`;
  const existing = arrayPromises.get(key);
  if (existing) return existing;

  const promise = getStore(url)
    .then((ds) => zarr.open(ds.root.resolve(variable), { kind: "array" }))
    .then((array) => array as unknown as ChunkSource)
    .catch((error) => {
      arrayPromises.delete(key);
      throw error;
    });

  arrayPromises.set(key, promise);
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

    const kept = await withRequestContext(sink, controller.signal, (init) =>
      readPatch(array, request, init),
    );

    scope.postMessage(
      {
        id: request.id,
        type: "result",
        data: kept.data,
        shape: kept.shape,
        block: kept.block,
      } satisfies ChunkResponse,
      [kept.data.buffer],
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

  if (message.concurrent) {
    void handle(message);
    return;
  }
  queue = queue.then(() => handle(message));
};
