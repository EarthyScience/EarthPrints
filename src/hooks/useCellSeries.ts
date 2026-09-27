"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { geoPointToZarrGrid } from "@/lib/map/geogrid";
import {
  readConnectionHint,
  shouldWarmCache,
  type UserPosition,
} from "@/lib/map/geolocate";
import { openZarrStore } from "@/lib/zarr/store";
import { ZarrChunkReader } from "@/lib/zarr/ZarrChunkReader";
import {
  cacheBytesFor,
  DEFAULT_PATCH_WINDOW,
  deviceCacheBytes,
  loadPatchWindow,
  savePatchWindow,
  type PatchWindowSize,
} from "@/lib/settings/patchWindow";
import { DEFAULT_GRID_SPEC } from "@/lib/constants/store";
import type { GridSpec, MapSelection } from "@/types/map";

export type SeriesProgress = { loaded: number; total: number };

export function useCellSeries() {
  const readerPromiseRef = useRef<Promise<ZarrChunkReader> | null>(null);
  const requestIdRef = useRef(0);
  const seriesAbortRef = useRef<AbortController | null>(null);
  // The decode worker runs one job at a time, so a real pick aborts the warm-up.
  const warmAbortRef = useRef<AbortController | null>(null);
  const patchWindowRef = useRef<PatchWindowSize>(DEFAULT_PATCH_WINDOW);

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
  const [units, setUnits] = useState<string | null>(null);

  const ensureReader = useCallback(() => {
    if (!readerPromiseRef.current) {
      readerPromiseRef.current = openZarrStore()
        .then(
          (ds) =>
            new ZarrChunkReader(ds, {
              windowSize: patchWindowRef.current,
              maxBytes: cacheBytesFor(
                patchWindowRef.current,
                deviceCacheBytes(),
              ),
            }),
        )
        .catch((cause) => {
          readerPromiseRef.current = null;
          throw cause;
        });
    }
    return readerPromiseRef.current;
  }, []);

  useEffect(() => {
    let cancelled = false;
    ensureReader()
      .then((reader) => reader.getGridSpec())
      .then((spec) => {
        if (!cancelled) setGridSpec(spec);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [ensureReader]);

  const load = useCallback(
    async (nextSelection: MapSelection, years: number[]) => {
      const requestId = ++requestIdRef.current;
      seriesAbortRef.current?.abort();
      const abort = new AbortController();
      seriesAbortRef.current = abort;
      setLoading(true);
      setProgress(null);
      setError(null);
      setValues(null);
      setUnits(null);

      try {
        const reader = await ensureReader();
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
        );

        if (requestId !== requestIdRef.current) return;

        setValues(result.values);
        setUnits(result.units ?? null);
        setCachedYears(new Set(reader.getCachedYears(nextSelection.grid)));
      } catch (cause) {
        if (requestId !== requestIdRef.current) return;
        if (cause instanceof Error && cause.name === "AbortError") return;
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
    [ensureReader],
  );

  const select = useCallback(
    (lon: number, lat: number): MapSelection => {
      const nextSelection: MapSelection = {
        click: { lon, lat },
        grid: geoPointToZarrGrid({ lon, lat }, gridSpec),
      };
      warmAbortRef.current?.abort();
      setSelection(nextSelection);
      void load(nextSelection, selectedYears);
      return nextSelection;
    },
    [gridSpec, load, selectedYears],
  );

  const selectYears = useCallback(
    (years: number[]) => {
      setSelectedYears(years);
      if (selection) void load(selection, years);
    },
    [load, selection],
  );

  const warm = useCallback(
    async (position: UserPosition) => {
      if (!shouldWarmCache(readConnectionHint())) return;
      warmAbortRef.current?.abort();
      const abort = new AbortController();
      warmAbortRef.current = abort;
      try {
        const reader = await ensureReader();
        const spec = await reader.getGridSpec();
        if (abort.signal.aborted) return;
        await reader.getTimeSeriesForYears(
          geoPointToZarrGrid(position, spec),
          selectedYears,
          undefined,
          undefined,
          abort.signal,
        );
      } catch {
      } finally {
        if (warmAbortRef.current === abort) warmAbortRef.current = null;
      }
    },
    [ensureReader, selectedYears],
  );

  useEffect(() => () => warmAbortRef.current?.abort(), []);

  useEffect(() => {
    const stored = loadPatchWindow();
    if (stored === patchWindowRef.current) return;

    patchWindowRef.current = stored;
    setPatchWindowState(stored);
    void readerPromiseRef.current?.then((reader) => {
      reader.setWindowSize(stored, cacheBytesFor(stored, deviceCacheBytes()));
    });
  }, []);

  const setPatchWindow = useCallback(
    (size: PatchWindowSize) => {
      if (size === patchWindowRef.current) return;

      patchWindowRef.current = size;
      setPatchWindowState(size);
      savePatchWindow(size);
      // Cached entries are cut to the old window and cannot be reused.
      setCachedYears(new Set());
      void readerPromiseRef.current?.then((reader) => {
        reader.setWindowSize(size, cacheBytesFor(size, deviceCacheBytes()));
        if (selection) void load(selection, selectedYears);
      });
    },
    [load, selectedYears, selection],
  );

  return {
    gridSpec,
    selection,
    select,
    selectedYears,
    selectYears,
    cachedYears,
    patchWindow,
    setPatchWindow,
    loading,
    progress,
    error,
    values,
    units,
    warm,
  };
}

export type CellSeries = ReturnType<typeof useCellSeries>;
