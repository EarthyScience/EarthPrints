"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { geoPointToZarrGrid, isPointInGrid } from "@/lib/map/geogrid";
import { SeriesBudgetError, ZarrChunkReader } from "@/lib/zarr/ZarrChunkReader";
import { openDataset, type Dataset } from "@/lib/zarr/dataset";
import { setActiveSource } from "@/lib/zarr/activeSource";
import { setActiveTime, yearToDateRange } from "@/lib/zarr/timeRange";
import { samplesInDays } from "@/lib/zarr/timeAxis";
import {
  defaultYears,
  readSourceFromUrl,
  writeSourceToUrl,
  type SourceRequest,
} from "@/lib/zarr/sourceUrl";
import {
  cacheBytesFor,
  DEFAULT_PATCH_WINDOW,
  deviceCacheBytes,
  loadPatchWindow,
  savePatchWindow,
  type PatchWindowSize,
} from "@/lib/settings/patchWindow";
import { DEFAULT_GRID_SPEC } from "@/lib/constants/store";
import type { GeoPoint, GridSpec, MapSelection } from "@/types/map";

export type SeriesProgress = { loaded: number; total: number };

const OPEN_TIMEOUT_MS = 30_000;

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (cause) => {
        clearTimeout(timer);
        reject(cause);
      },
    );
  });
}

function selectionAt(click: GeoPoint, spec: GridSpec): MapSelection {
  const grid = geoPointToZarrGrid(click, spec);
  if (isPointInGrid(click, spec)) return { click, grid };
  return { click, grid: { ...grid, lon: click.lon, lat: click.lat }, outside: true };
}

function activate(dataset: Dataset) {
  setActiveTime(dataset.time);
  setActiveSource({
    title: dataset.title,
    url: dataset.url,
    variable: dataset.variable,
    longName: dataset.longName,
    resolutionDeg: dataset.grid.spatialResolutionDeg,
    stepLabel: dataset.time.stepLabel,
  });
}

export function useCellSeries() {
  const readerRef = useRef<ZarrChunkReader | null>(null);
  const readerPromiseRef = useRef<Promise<ZarrChunkReader> | null>(null);
  const requestIdRef = useRef(0);
  const openIdRef = useRef(0);
  const seriesAbortRef = useRef<AbortController | null>(null);
  const patchWindowRef = useRef<PatchWindowSize>(DEFAULT_PATCH_WINDOW);

  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [datasetLoading, setDatasetLoading] = useState(true);
  const [datasetError, setDatasetError] = useState<string | null>(null);
  /** The store last asked for, so a failed or slow open can still show it. */
  const [requestedSource, setRequestedSource] = useState<SourceRequest | null>(null);
  const [extraIndices, setExtraIndices] = useState<Record<number, number>>({});
  const [gridSpec, setGridSpec] = useState<GridSpec>(DEFAULT_GRID_SPEC);
  const [selection, setSelection] = useState<MapSelection | null>(null);
  const [selectedYears, setSelectedYears] = useState<number[]>([2021]);
  const [cachedYears, setCachedYears] = useState<Set<number>>(new Set());
  const [patchWindow, setPatchWindowState] =
    useState<PatchWindowSize>(DEFAULT_PATCH_WINDOW);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<SeriesProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [values, setValues] = useState<Float32Array | null>(null);
  /** Days a partial load could cover, offered when the full one is refused. */
  const [partialOffer, setPartialOffer] = useState<{ days: number; bytes: number } | null>(null);
  /** Days a partial load did cover, from the start of the selection. */
  const [coveredDays, setCoveredDays] = useState<number | null>(null);
  const [units, setUnits] = useState<string | null>(null);

  const load = useCallback(
    async (nextSelection: MapSelection, years: number[], partial = false) => {
      const requestId = ++requestIdRef.current;
      seriesAbortRef.current?.abort();
      const abort = new AbortController();
      seriesAbortRef.current = abort;
      setLoading(true);
      setProgress(null);
      setError(null);
      setValues(null);
      setUnits(null);
      setPartialOffer(null);
      setCoveredDays(null);

      try {
        const reader = await readerPromiseRef.current;
        if (requestId !== requestIdRef.current) return;
        if (!reader) {
          setError("No dataset is open. Open one from the Data panel.");
          return;
        }
        if (nextSelection.outside) {
          setError("This point is outside the area the dataset covers. Pick a point inside it.");
          return;
        }
        setCachedYears(new Set(reader.getCachedYears(nextSelection.grid)));

        const result = await reader.getTimeSeriesForYears(
          nextSelection.grid,
          years,
          undefined,
          (loaded, total) => {
            if (requestId !== requestIdRef.current) return;
            setProgress({ loaded, total });
          },
          abort.signal,
          { partial },
        );

        if (requestId !== requestIdRef.current) return;

        setValues(result.values);
        setCoveredDays(result.coveredDays ?? null);
        setUnits(result.units ?? null);
        setCachedYears(new Set(reader.getCachedYears(nextSelection.grid)));
      } catch (cause) {
        if (requestId !== requestIdRef.current) return;
        if (cause instanceof Error && cause.name === "AbortError") return;
        if (cause instanceof SeriesBudgetError && cause.partialDays > 0) {
          setPartialOffer({ days: cause.partialDays, bytes: cause.partialBytes });
        }
        setError(
          cause instanceof Error
            ? cause.message
            : "Could not load the Zarr time series.",
        );
      } finally {
        if (requestId === requestIdRef.current) {
          setLoading(false);
          setProgress(null);
        }
      }
    },
    [],
  );

  // Kept in refs so opening a store can re-snap and reload whatever is picked.
  const selectionRef = useRef<MapSelection | null>(null);
  const selectedYearsRef = useRef(selectedYears);
  const pickedYearsRef = useRef(false);
  useEffect(() => {
    selectionRef.current = selection;
    selectedYearsRef.current = selectedYears;
  }, [selection, selectedYears]);

  // Sets state only once the store answers, so the first open can run from an
  // effect; `openSource` below flags the loading state first.
  const startOpen = useCallback(
    (request: SourceRequest) => {
      const openId = ++openIdRef.current;
      const promise = withTimeout(
        openDataset(request.url, request.variable),
        OPEN_TIMEOUT_MS,
        "The store did not answer within 30 seconds. It may be offline or very slow.",
      ).then(
        ({ dataset: next, store }) => {
          const reader = new ZarrChunkReader(store, {
            dataset: next,
            windowSize: patchWindowRef.current,
            maxBytes: cacheBytesFor(patchWindowRef.current, deviceCacheBytes()),
          });
          const picks: Record<number, number> = {};
          for (const dim of next.layout.extras) {
            const wanted = request.picks?.[dim.name] ?? 0;
            const index = Math.min(Math.max(0, wanted), dim.size - 1);
            picks[dim.axis] = index;
            reader.setExtraIndex(dim.axis, index);
          }
          return { next, reader, picks };
        },
      );

      readerPromiseRef.current = promise
        .then(({ reader }) => reader)
        .catch(() => readerRef.current as ZarrChunkReader);

      promise
        .then(({ next, reader, picks }) => {
          if (openId !== openIdRef.current) {
            reader.dispose();
            return;
          }
          readerRef.current?.dispose();
          readerRef.current = reader;
          activate(next);
          setDataset(next);
          setExtraIndices(picks);
          setGridSpec(next.grid);
          setDatasetLoading(false);
          writeSourceToUrl(next, picks);

          // Years the reader picked carry over to the new store; the
          // starting 2021 does not, so a store opens on its own last year.
          const years = defaultYears(
            next.time.years,
            pickedYearsRef.current ? selectedYearsRef.current : [],
          );
          setSelectedYears(years);
          const previous = selectionRef.current;
          if (previous) {
            const moved = selectionAt(previous.click, next.grid);
            setSelection(moved);
            void load(moved, years);
          }
        })
        .catch((cause) => {
          if (openId !== openIdRef.current) return;
          setDatasetLoading(false);
          setDatasetError(
            cause instanceof Error ? cause.message : "The store could not be opened.",
          );
        });
    },
    [load],
  );

  const openSource = useCallback(
    (request: SourceRequest) => {
      setDatasetLoading(true);
      setDatasetError(null);
      setRequestedSource(request);
      startOpen(request);
    },
    [startOpen],
  );

  useEffect(() => {
    const request = readSourceFromUrl();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mirrors the address bar once on load
    setRequestedSource(request);
    startOpen(request);
  }, [startOpen]);

  useEffect(
    () => () => {
      readerRef.current?.dispose();
    },
    [],
  );

  const select = useCallback(
    (lon: number, lat: number): MapSelection => {
      const nextSelection = selectionAt({ lon, lat }, gridSpec);
      setSelection(nextSelection);
      void load(nextSelection, selectedYears);
      return nextSelection;
    },
    [gridSpec, load, selectedYears],
  );

  const selectYears = useCallback(
    (years: number[]) => {
      pickedYearsRef.current = true;
      setSelectedYears(years);
      if (selection) void load(selection, years);
    },
    [load, selection],
  );

  const loadPartial = useCallback(() => {
    if (selection) void load(selection, selectedYears, true);
  }, [load, selectedYears, selection]);

  const setExtraIndex = useCallback(
    (axis: number, index: number) => {
      const reader = readerRef.current;
      if (!reader || !dataset) return;
      reader.setExtraIndex(axis, index);
      const picks = { ...extraIndices, [axis]: index };
      setExtraIndices(picks);
      writeSourceToUrl(dataset, picks);
      if (selection) void load(selection, selectedYears);
    },
    [dataset, extraIndices, load, selectedYears, selection],
  );

  useEffect(() => {
    const stored = loadPatchWindow();
    if (stored === patchWindowRef.current) return;

    patchWindowRef.current = stored;
    setPatchWindowState(stored);
    readerRef.current?.setWindowSize(
      stored,
      cacheBytesFor(stored, deviceCacheBytes()),
    );
  }, []);

  const setPatchWindow = useCallback(
    (size: PatchWindowSize) => {
      if (size === patchWindowRef.current) return;

      patchWindowRef.current = size;
      setPatchWindowState(size);
      savePatchWindow(size);
      // Cached entries are cut to the old window and cannot be reused.
      setCachedYears(new Set());
      readerRef.current?.setWindowSize(size, cacheBytesFor(size, deviceCacheBytes()));
      if (selection) void load(selection, selectedYears);
    },
    [load, selectedYears, selection],
  );

  // Coarse stores fill several days per sample, so the filled grid's length
  // says nothing about how many values the store holds for these years.
  const stepCount = useMemo(() => {
    if (!dataset) return null;
    // A store with its own hour axis holds a day's slots in each time sample.
    const perSample = dataset.time.hourAxis ? dataset.time.slotsPerDay : 1;
    return perSample * selectedYears.reduce(
      (sum, year) =>
        sum +
        samplesInDays(
          dataset.time,
          yearToDateRange(year, dataset.time.totalDays),
        ),
      0,
    );
  }, [dataset, selectedYears]);

  return {
    dataset,
    datasetLoading,
    datasetError,
    requestedSource,
    openSource,
    extraIndices,
    setExtraIndex,
    slotsPerDay: dataset?.time.slotsPerDay ?? 24,
    timeSpan: dataset?.time.span ?? "slot",
    stepLabel: dataset?.time.stepLabel ?? "hourly",
    stepCount,
    gridSpec,
    selection,
    select,
    selectedYears,
    selectYears,
    cachedYears,
    patchWindow,
    setPatchWindow,
    loading: loading || (datasetLoading && selection !== null),
    progress,
    error,
    partialOffer,
    coveredDays,
    loadPartial,
    values,
    units: units ?? dataset?.units ?? null,
  };
}

export type CellSeries = ReturnType<typeof useCellSeries>;
