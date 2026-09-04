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

/** A rectangular lat/lon window inside one native chunk, in chunk-local coords. */
export type LocalBlock = {
  localLatStart: number;
  localLatCount: number;
  localLonStart: number;
  localLonCount: number;
};

/** Cache key for one pixel's slice of one native time chunk. */
export function pixelSeriesKey(
  variable: string,
  latIndex: number,
  lonIndex: number,
  timeChunkIdx: number,
): string {
  return `${variable}:${latIndex}:${lonIndex}:${timeChunkIdx}`;
}

/**
 * Square window of `radius` pixels around a pixel, clamped to the decoded
 * chunk's real lat/lon extent. Decoding a chunk is the expensive step, so we
 * harvest the neighbours while we have it rather than re-fetching 182 MB when
 * the user clicks one cell over.
 */
export function neighborhoodBlock(
  localOffset: LocalOffset,
  radius: number,
  shape: readonly number[],
): LocalBlock {
  const [, , latCount, lonCount] = shape;
  const latStart = Math.max(0, localOffset.localLat - radius);
  const lonStart = Math.max(0, localOffset.localLon - radius);
  const latStop = Math.min(latCount, localOffset.localLat + radius + 1);
  const lonStop = Math.min(lonCount, localOffset.localLon + radius + 1);

  return {
    localLatStart: latStart,
    localLatCount: Math.max(0, latStop - latStart),
    localLonStart: lonStart,
    localLonCount: Math.max(0, lonStop - lonStart),
  };
}

/**
 * Pull every pixel in `block` out of a decoded chunk as one contiguous buffer,
 * laid out lat-major then lon, each pixel holding `timeCount * hourCount`
 * values. Sized for transfer to the main thread; the chunk itself stays behind.
 */
export function extractBlockFromNativeChunk(
  data: Float32Array,
  shape: readonly number[],
  block: LocalBlock,
): Float32Array {
  const [timeCount, hourCount] = shape;
  const seriesLength = timeCount * hourCount;
  const out = new Float32Array(
    seriesLength * block.localLatCount * block.localLonCount,
  );

  let offset = 0;
  for (let lat = 0; lat < block.localLatCount; lat++) {
    for (let lon = 0; lon < block.localLonCount; lon++) {
      out.set(
        extractPixelFromNativeChunk(data, shape, {
          localLat: block.localLatStart + lat,
          localLon: block.localLonStart + lon,
        }),
        offset,
      );
      offset += seriesLength;
    }
  }

  return out;
}
