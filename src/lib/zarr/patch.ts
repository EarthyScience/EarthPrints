import {
  alignedSubBlock,
  canonicalizeChunk,
  type ChunkDecode,
  type ChunkPlan,
  type LocalBlock,
} from "@/lib/zarr/chunks";

export type PatchRequest = {
  chunkCoords: number[];
  plan: ChunkPlan;
  decode: ChunkDecode;
  /** Cells kept per side, aligned to a tiling of the chunk. */
  windowSize: number;
  /** The pixel that must land inside the kept window. */
  localLat: number;
  localLon: number;
};

export type DecodedPatch = {
  data: Float32Array;
  /** `[time, hour, lat, lon]` of what is kept. */
  shape: number[];
  /** Where that window sits in the chunk, for rebasing pixel offsets. */
  block: LocalBlock;
};

export type ChunkSource = {
  getChunk(chunkCoords: number[], options?: RequestInit): Promise<{
    data: ArrayLike<number | bigint>;
    shape: number[];
    stride?: number[];
  }>;
};

function rowMajorStride(shape: readonly number[]): number[] {
  const stride = new Array<number>(shape.length);
  let step = 1;
  for (let axis = shape.length - 1; axis >= 0; axis--) {
    stride[axis] = step;
    step *= shape[axis]!;
  }
  return stride;
}

/** Read one stored chunk and keep the window around a pixel, decoded. */
export async function readPatch(
  array: ChunkSource,
  request: PatchRequest,
  init?: RequestInit,
): Promise<DecodedPatch> {
  const chunk = await array.getChunk(request.chunkCoords, init);
  const { plan } = request;
  const block = alignedSubBlock(
    { localLat: request.localLat, localLon: request.localLon },
    request.windowSize,
    [1, 1, chunk.shape[plan.lat] ?? 1, chunk.shape[plan.lon] ?? 1],
  );
  const kept = canonicalizeChunk(
    chunk.data,
    chunk.shape,
    chunk.stride ?? rowMajorStride(chunk.shape),
    plan,
    block,
    request.decode,
  );
  return { ...kept, block };
}
