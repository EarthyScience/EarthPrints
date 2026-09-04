import type {
  ChunkRequest,
  ChunkResponse,
} from "@/lib/zarr/chunk.worker";
import type { LocalBlock } from "@/lib/zarr/chunks";

export type DecodedBlock = {
  block: LocalBlock;
  seriesLength: number;
  values: Float32Array;
};

type Pending = {
  resolve: (value: DecodedBlock) => void;
  reject: (error: Error) => void;
  onProgress?: (loaded: number, total: number) => void;
};

/**
 * Main-thread half of the decode worker. Returns null from `create` when the
 * environment has no `Worker` (SSR, jsdom, unit tests) so callers can fall
 * back to decoding inline.
 */
export class ChunkWorkerClient {
  private worker: Worker;
  private pending = new Map<number, Pending>();
  private nextId = 0;

  private constructor(worker: Worker) {
    this.worker = worker;
    this.worker.onmessage = (event: MessageEvent<ChunkResponse>) => {
      this.receive(event.data);
    };
    this.worker.onerror = () => {
      const error = new Error("Chunk decode worker failed");
      for (const entry of this.pending.values()) entry.reject(error);
      this.pending.clear();
    };
  }

  static create(): ChunkWorkerClient | null {
    if (typeof Worker === "undefined") return null;
    try {
      return new ChunkWorkerClient(
        new Worker(new URL("./chunk.worker.ts", import.meta.url), {
          type: "module",
        }),
      );
    } catch {
      return null;
    }
  }

  private receive(message: ChunkResponse): void {
    const entry = this.pending.get(message.id);
    if (!entry) return;

    if (message.type === "progress") {
      entry.onProgress?.(message.loaded, message.total);
      return;
    }

    this.pending.delete(message.id);
    if (message.type === "error") {
      entry.reject(new Error(message.message));
      return;
    }

    entry.resolve({
      block: message.block,
      seriesLength: message.seriesLength,
      values: message.values,
    });
  }

  decode(
    request: Omit<ChunkRequest, "id">,
    onProgress?: (loaded: number, total: number) => void,
  ): Promise<DecodedBlock> {
    const id = ++this.nextId;
    return new Promise<DecodedBlock>((resolve, reject) => {
      this.pending.set(id, { resolve, reject, onProgress });
      this.worker.postMessage({ ...request, id } satisfies ChunkRequest);
    });
  }

  terminate(): void {
    this.worker.terminate();
    this.pending.clear();
  }
}
