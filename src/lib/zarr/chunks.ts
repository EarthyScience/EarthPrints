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
  /** Window-aligned sub-block inside the chunk; omitted when it is the chunk. */
  subLatIdx?: number;
  subLonIdx?: number;
};

/** A rectangular region of a decoded chunk, in chunk-local coordinates. */
export type LocalBlock = {
  localLatStart: number;
  localLatCount: number;
  localLonStart: number;
  localLonCount: number;
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

/**
 * Cache key for one on-disk Zarr chunk, or for one window-aligned sub-block of
 * it when the reader is holding less than a whole chunk.
 */
export function nativeChunkKey(
  variable: string,
  coords: NativeChunkCoords,
): string {
  const chunk = `${variable}:${coords.timeChunkIdx}:${coords.hourChunkIdx}:${coords.latChunkIdx}:${coords.lonChunkIdx}`;
  if (coords.subLatIdx === undefined || coords.subLonIdx === undefined) {
    return chunk;
  }
  return `${chunk}:${coords.subLatIdx}:${coords.subLonIdx}`;
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
  timeRange?: AxisSlice,
): PixelNativeChunkContext {
  const { chunkLatIdx, chunkLonIdx } = pixelToChunkIndices(
    latIndex,
    lonIndex,
    chunkSizes.lat,
    chunkSizes.lon,
  );

  const timeChunkIndices = timeRange
    ? listTimeChunkIndicesForRange(timeRange, chunkSizes.time, timeCount)
    : listTimeChunkIndices(timeCount, chunkSizes.time);

  return {
    chunkLatIdx,
    chunkLonIdx,
    localLat: latIndex - chunkLatIdx * chunkSizes.lat,
    localLon: lonIndex - chunkLonIdx * chunkSizes.lon,
    timeChunkIndices,
  };
}

/** List native time-chunk indices that overlap a day slice. */
export function listTimeChunkIndicesForRange(
  timeRange: AxisSlice,
  chunkTime: number,
  totalDays: number,
): number[] {
  const [start, stop] = timeRange;
  const clampedStart = Math.max(0, start);
  const clampedStop = Math.min(stop, totalDays);
  if (clampedStart >= clampedStop) return [];

  const firstChunk = Math.floor(clampedStart / chunkTime);
  const lastChunk = Math.floor((clampedStop - 1) / chunkTime);
  return Array.from(
    { length: lastChunk - firstChunk + 1 },
    (_, index) => firstChunk + index,
  );
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

type TimeChunkSegment = {
  values: Float32Array;
  chunkStartDay: number;
};

/** Trim stitched native-chunk segments to a day slice. */
export function stitchTimeSeriesForRange(
  segments: TimeChunkSegment[],
  timeRange: AxisSlice,
  hourCount: number,
): Float32Array {
  const [rangeStart, rangeStop] = timeRange;
  const parts: Float32Array[] = [];

  for (const { values, chunkStartDay } of segments) {
    const chunkDayCount = values.length / hourCount;
    const chunkStopDay = chunkStartDay + chunkDayCount;
    const overlapStart = Math.max(rangeStart, chunkStartDay);
    const overlapStop = Math.min(rangeStop, chunkStopDay);
    if (overlapStart >= overlapStop) continue;

    const localStart = overlapStart - chunkStartDay;
    const localStop = overlapStop - chunkStartDay;
    parts.push(values.subarray(localStart * hourCount, localStop * hourCount));
  }

  return stitchTimeSeries(parts);
}

/**
 * Which window-aligned sub-block of a chunk a local offset falls in.
 *
 * The windows tile the chunk on a fixed grid rather than centring on the
 * clicked cell, so every cell inside one window shares a cache key and the
 * first click pays for all of them. A centred window would give each cell its
 * own extent and its own download, which is what made the old 5x5 harvest miss
 * so often.
 */
export function subBlockIndices(
  localOffset: LocalOffset,
  windowSize: number,
): { subLatIdx: number; subLonIdx: number } {
  return {
    subLatIdx: Math.floor(localOffset.localLat / windowSize),
    subLonIdx: Math.floor(localOffset.localLon / windowSize),
  };
}

/** The bounds of that sub-block, clamped to the chunk's own extent. */
export function alignedSubBlock(
  localOffset: LocalOffset,
  windowSize: number,
  shape: readonly number[],
): LocalBlock {
  const [, , latCount = 0, lonCount = 0] = shape;
  const { subLatIdx, subLonIdx } = subBlockIndices(localOffset, windowSize);
  const localLatStart = subLatIdx * windowSize;
  const localLonStart = subLonIdx * windowSize;

  return {
    localLatStart,
    localLatCount: Math.max(0, Math.min(windowSize, latCount - localLatStart)),
    localLonStart,
    localLonCount: Math.max(0, Math.min(windowSize, lonCount - localLonStart)),
  };
}

/** Whether a block already covers the whole chunk, so slicing would be a copy. */
export function blockCoversChunk(
  block: LocalBlock,
  shape: readonly number[],
): boolean {
  return (
    block.localLatStart === 0 &&
    block.localLonStart === 0 &&
    block.localLatCount === (shape[2] ?? 0) &&
    block.localLonCount === (shape[3] ?? 0)
  );
}

/**
 * Cut a sub-block out of a decoded chunk, keeping the chunk's own axis order.
 *
 * The result is just a smaller chunk: `[time, hour, lat, lon]` with the lat and
 * lon axes trimmed, so everything that reads a decoded chunk reads a block too,
 * given offsets rebased onto the block's origin.
 */
export function sliceBlockFromNativeChunk(
  data: Float32Array,
  shape: readonly number[],
  block: LocalBlock,
): { data: Float32Array; shape: number[] } {
  const [timeCount = 0, hourCount = 0, latCount = 0, lonCount = 0] = shape;
  const { localLatStart, localLatCount, localLonStart, localLonCount } = block;
  const out = new Float32Array(
    timeCount * hourCount * localLatCount * localLonCount,
  );

  let cursor = 0;
  for (let t = 0; t < timeCount; t++) {
    for (let h = 0; h < hourCount; h++) {
      const planeStart = (t * hourCount + h) * latCount;
      for (let lat = 0; lat < localLatCount; lat++) {
        const rowStart =
          (planeStart + localLatStart + lat) * lonCount + localLonStart;
        out.set(data.subarray(rowStart, rowStart + localLonCount), cursor);
        cursor += localLonCount;
      }
    }
  }

  return {
    data: out,
    shape: [timeCount, hourCount, localLatCount, localLonCount],
  };
}
