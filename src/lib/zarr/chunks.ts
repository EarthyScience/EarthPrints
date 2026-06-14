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

export type SpatialChunkSlices = {
  latSlice: AxisSlice;
  lonSlice: AxisSlice;
};

/** Map a pixel index to its spatial chunk index along one axis. */
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

/** Cache key for one spatial chunk of a variable. */
export function pixelToChunkKey(
  variable: string,
  latIndex: number,
  lonIndex: number,
  chunkLat: number,
  chunkLon: number,
): string {
  const { chunkLatIdx, chunkLonIdx } = pixelToChunkIndices(
    latIndex,
    lonIndex,
    chunkLat,
    chunkLon,
  );
  return `${variable}:${chunkLatIdx}:${chunkLonIdx}`;
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

/** Lat/lon slice ranges for fetching one spatial chunk from a 4D `[time, hour, lat, lon]` array. */
export function spatialChunkToSlices(
  chunkLatIdx: number,
  chunkLonIdx: number,
  chunkLat: number,
  chunkLon: number,
  latCount: number,
  lonCount: number,
): SpatialChunkSlices {
  return {
    latSlice: chunkIndexToSlice(chunkLatIdx, chunkLat, latCount),
    lonSlice: chunkIndexToSlice(chunkLonIdx, chunkLon, lonCount),
  };
}

/** Pick one pixel's time series out of a downloaded spatial chunk. */
export function extractTimeSeries(
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
