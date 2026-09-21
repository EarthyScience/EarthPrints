---
name: earthprints-zarr-data
description: >-
  Reference for the EarthPrints Zarr data layer: store constants, ZarrChunkReader,
  Web Worker decoding, LRU cache, time axis, local-time conversion, and grid
  geometry. Activate when working on data fetching, time handling, grid maths,
  or cache behaviour.
---

# EarthPrints — Zarr Data Layer Reference

## Key Files

| File | Role |
|---|---|
| `src/lib/constants/store.ts` | `ZARR_STORE`, `ZARR_TIME` constants |
| `src/lib/zarr/store.ts` | HTTP fetch layer, progress/abort sinks |
| `src/lib/zarr/ZarrChunkReader.ts` | Main data-fetching class (600+ lines) |
| `src/lib/zarr/chunks.ts` | Chunk math: slicing, stitching, block indices |
| `src/lib/zarr/chunk.worker.ts` | Web Worker — decodes Zarr chunks off main thread |
| `src/lib/zarr/chunkWorkerClient.ts` | Comlink-style client to the worker |
| `src/lib/zarr/timeRange.ts` | Day indexing, year ranges, `dayIndexToUTCDate` |
| `src/lib/zarr/localTime.ts` | UTC→local solar time conversion |
| `src/lib/zarr/gridSpec.ts` | `GridSpec` derivation (lat/lon bounds, resolution) |
| `src/lib/zarr/series.ts` | `hasFiniteValues` utility |

---

## Time Axis

```ts
// Origin: 2001-01-01 UTC (day 0).
// Each absolute day index maps to a UTC date:
dayIndexToUTCDate(absoluteDay: number): Date

// Time constants (from ZARR_TIME):
hoursPerDay = 24
// Total length = nYears × 365 days × 24 hours
```

### Year / Day mapping

```ts
// Convert a list of selected years to a contiguous day mapping:
getSelectedYearsDayMapping(years, utcOffset?, maxDays?): DayMapping
// → { absoluteDays: number[], yearIntervals: YearInterval[] }

// yearIntervals is used by the square badge to draw year divider lines.
```

### Local Solar Time

```ts
// Roll a UTC series onto local solar time (shift by utcOffset hours):
shiftSeriesToLocalTime(values: Float32Array, utcOffsetHours: number): Float32Array
// Wraps around day boundaries. Edge hours become NaN (no data to fill).

// Compute the offset from lon:
localHourOffset(lon: number): number   // ≈ lon / 15, rounded to nearest int

// Format for display:
formatTimeBasis(basis: TimeBasis, offsetHours: number): string
// "Local solar time (UTC+10)" etc.
```

---

## ZarrChunkReader

```ts
const reader = new ZarrChunkReader();

// Fetch a full time series for a grid cell:
const series = await reader.fetchSeries(cell: GridCell, years: number[]);
// → Float32Array, length = nDays × hoursPerDay

// Abort in-flight request:
reader.abort();

// Progress callback (bytes loaded / total):
reader.onProgress = (loaded, total) => { ... };
```

### LRU Cache

- Default ceiling: `DESKTOP_CACHE_BYTES` (500 MB).
- Cache key: `nativeChunkKey(variable, chunkIndices)`.
- Eviction is LRU. The `patchWindow` setting controls how many surrounding
  chunks to pre-fetch when a cell is selected.

---

## Grid Geometry

```ts
type GridCell = { row: number; col: number };   // 0-indexed
type GridSpec = {
  rows: number; cols: number;         // array dimensions
  latMin: number; latMax: number;
  lonMin: number; lonMax: number;
};

// Convert pixel click → GridCell:
// Done in EarthMap via deck.gl layer pick info.

// Geographic coordinates of a cell centre:
gridCellToLatLon(cell: GridCell, spec: GridSpec): { lat: number; lon: number }

// Inverse:
latLonToGridCell(lat: number, lon: number, spec: GridSpec): GridCell
```

---

## Progress & Abort Pattern

```ts
// Before a fetch:
const sink = createByteProgressSink((loaded, total) => setProgress({ loaded, total }));
setActiveByteSink(sink);
setActiveAbortSignal(controller.signal);

// After fetch completes or is aborted:
setActiveByteSink(null);
setActiveAbortSignal(null);
```

---

## Common Gotchas

- `Float32Array` values for ocean / bare ground / missing are `NaN`.
  Always guard with `Number.isFinite(v)` before using a value.
- Day indices are **local** (0 = first day of the loaded window) inside
  `FingerprintPlot` and **absolute** (days since 2001-01-01) in `timeRange.ts`.
  `dayMapping.absoluteDays[localIndex]` converts between them.
- `shiftSeriesToLocalTime` blanks edge hours with `NaN`. The asymmetric
  extents and `symmetricAbsMax` both skip `NaN`, so this is safe.
- The Web Worker (`chunk.worker.ts`) must not import any browser-only APIs.
  Keep it pure TypeScript with no DOM dependencies.
