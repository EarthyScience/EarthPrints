/** Half-open interval `[start, stop)` for one axis slice passed to zarrita. */
export type AxisSlice = [start: number, stop: number];

export type ChunkIndices = {
  chunkLatIdx: number;
  chunkLonIdx: number;
};

export type LocalOffset = {
  localLat: number;
  localLon: number;
};

export type ArrayChunkSizes = {
  time: number;
  hour: number;
  lat: number;
  lon: number;
};

export type NativeChunkCoords = {
  timeChunkIdx: number;
  hourChunkIdx: number;
  latChunkIdx: number;
  lonChunkIdx: number;
};

export type PixelNativeChunkContext = ChunkIndices &
  LocalOffset & {
    timeChunkIndices: number[];
  };

/** Map a pixel index to its chunk index along one axis. */
export function indexToChunkIndex(index: number, chunkSize: number): number {
  return Math.floor(index / chunkSize);
}

/** Convert a chunk index to a half-open `[start, stop)` slice, clamped to axis length. */
export function chunkIndexToSlice(
  chunkIdx: number,
  chunkSize: number,
  axisLength: number,
): AxisSlice {
  const start = chunkIdx * chunkSize;
  const stop = Math.min(start + chunkSize, axisLength);
  return [start, stop];
}

export function pixelToChunkIndices(
  latIndex: number,
  lonIndex: number,
  chunkLat: number,
  chunkLon: number,
): ChunkIndices {
  return {
    chunkLatIdx: indexToChunkIndex(latIndex, chunkLat),
    chunkLonIdx: indexToChunkIndex(lonIndex, chunkLon),
  };
}

export function pixelToLocalOffset(
  latIndex: number,
  lonIndex: number,
  chunkLat: number,
  chunkLon: number,
): LocalOffset {
  const { chunkLatIdx, chunkLonIdx } = pixelToChunkIndices(
    latIndex,
    lonIndex,
    chunkLat,
    chunkLon,
  );
  return {
    localLat: latIndex - chunkLatIdx * chunkLat,
    localLon: lonIndex - chunkLonIdx * chunkLon,
  };
}

/** Cache key for one on-disk Zarr chunk. */
export function nativeChunkKey(
  variable: string,
  coords: NativeChunkCoords,
): string {
  return `${variable}:${coords.timeChunkIdx}:${coords.hourChunkIdx}:${coords.latChunkIdx}:${coords.lonChunkIdx}`;
}

export function listTimeChunkIndices(
  timeCount: number,
  chunkTime: number,
): number[] {
  const chunkCount = Math.ceil(timeCount / chunkTime);
  return Array.from({ length: chunkCount }, (_, index) => index);
}

/** Resolve native-chunk indices and local offsets for one pixel. */
export function pixelToNativeChunkContext(
  latIndex: number,
  lonIndex: number,
  timeCount: number,
  chunkSizes: ArrayChunkSizes,
): PixelNativeChunkContext {
  const { chunkLatIdx, chunkLonIdx } = pixelToChunkIndices(
    latIndex,
    lonIndex,
    chunkSizes.lat,
    chunkSizes.lon,
  );

  return {
    chunkLatIdx,
    chunkLonIdx,
    localLat: latIndex - chunkLatIdx * chunkSizes.lat,
    localLon: lonIndex - chunkLonIdx * chunkSizes.lon,
    timeChunkIndices: listTimeChunkIndices(timeCount, chunkSizes.time),
  };
}

/** Pick one pixel's series out of a single native on-disk chunk. */
export function extractPixelFromNativeChunk(
  data: Float32Array,
  shape: readonly number[],
  localOffset: LocalOffset,
): Float32Array {
  const [timeCount, hourCount, latCount, lonCount] = shape;
  const { localLat, localLon } = localOffset;

  const series = new Float32Array(timeCount * hourCount);
  let out = 0;

  for (let t = 0; t < timeCount; t++) {
    for (let h = 0; h < hourCount; h++) {
      const index =
        ((t * hourCount + h) * latCount + localLat) * lonCount + localLon;
      series[out++] = data[index]!;
    }
  }

  return series;
}

export function stitchTimeSeries(segments: Float32Array[]): Float32Array {
  const length = segments.reduce((total, segment) => total + segment.length, 0);
  const series = new Float32Array(length);
  let offset = 0;

  for (const segment of segments) {
    series.set(segment, offset);
    offset += segment.length;
  }

  return series;
}
