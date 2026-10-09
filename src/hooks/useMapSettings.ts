"use client";

import { useCallback, useState } from "react";
import type { TimeBasis } from "@/lib/zarr/localTime";

const AUTO_ZOOM_STORAGE_KEY = "earthprints:auto_zoom";
const TIME_BASIS_STORAGE_KEY = "earthprints:time_basis";

function loadAutoZoom(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const stored = window.localStorage.getItem(AUTO_ZOOM_STORAGE_KEY);
    if (stored !== null) return stored === "true";
  } catch {}
  return true;
}

function loadTimeBasis(): TimeBasis {
  if (typeof window === "undefined") return "local";
  try {
    if (window.localStorage.getItem(TIME_BASIS_STORAGE_KEY) === "utc") {
      return "utc";
    }
  } catch {}
  return "local";
}

export function useMapSettings() {
  const [autoZoom, setAutoZoomState] = useState(loadAutoZoom);
  const [showPatch, setShowPatch] = useState(true);
  const [timeBasis, setTimeBasisState] = useState(loadTimeBasis);

  const setAutoZoom = useCallback((next: boolean) => {
    setAutoZoomState(next);
    try {
      window.localStorage.setItem(AUTO_ZOOM_STORAGE_KEY, String(next));
    } catch {}
  }, []);

  const setTimeBasis = useCallback((next: TimeBasis) => {
    setTimeBasisState(next);
    try {
      window.localStorage.setItem(TIME_BASIS_STORAGE_KEY, next);
    } catch {}
  }, []);

  return {
    autoZoom,
    setAutoZoom,
    showPatch,
    setShowPatch,
    timeBasis,
    setTimeBasis,
  };
}

export type MapSettings = ReturnType<typeof useMapSettings>;
