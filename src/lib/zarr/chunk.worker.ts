/// <reference lib="webworker" />
import * as zarr from "zarrita";
import {
  alignedSubBlock,
  blockCoversChunk,
  sliceBlockFromNativeChunk,
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
 * at a time and killed it outright on phones. Here it is decompressed off the
 * main thread, and the window the caller asked to keep is cut out before the
 * handover, so the 224 MB array is dropped here and never reaches the main
 * thread's heap. A caller that wants the whole patch gets the decoded array
 * transferred as-is, with no copy.
 *
 * Requests are queued and served one at a time, which caps the memory held
 * during decoding at a single chunk no matter how many pixels are pending.
 */

export type ChunkRequest = {
  type: "decode";
  id: number;
  storeUrl: string;
  variable: string;
  chunkCoords: number[];
  /** Cells kept per side, aligned to a tiling of the chunk. */
  windowSize: number;
  /** The pixel that must land inside the kept window. */
  localLat: number;
  localLon: number;
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

    const block = alignedSubBlock(
      { localLat: request.localLat, localLon: request.localLon },
      request.windowSize,
      chunk.shape,
    );
    // A window that spans the chunk is the chunk: transfer it rather than
    // copying it into an identical array.
    const kept = blockCoversChunk(block, chunk.shape)
      ? { data: chunk.data, shape: chunk.shape }
      : sliceBlockFromNativeChunk(chunk.data, chunk.shape, block);

    scope.postMessage(
      {
        id: request.id,
        type: "result",
        data: kept.data,
        shape: kept.shape,
        block,
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

  queue = queue.then(() => handle(message));
};
