"use client";

import { useCallback, useState } from "react";

const AUTO_ZOOM_STORAGE_KEY = "earthprints:auto_zoom";

function loadAutoZoom(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const stored = window.localStorage.getItem(AUTO_ZOOM_STORAGE_KEY);
    if (stored !== null) return stored === "true";
  } catch {}
  return true;
}

export function useMapSettings() {
  const [autoZoom, setAutoZoomState] = useState(loadAutoZoom);
  const [showPatch, setShowPatch] = useState(true);

  const setAutoZoom = useCallback((next: boolean) => {
    setAutoZoomState(next);
    try {
      window.localStorage.setItem(AUTO_ZOOM_STORAGE_KEY, String(next));
    } catch {}
  }, []);

  return { autoZoom, setAutoZoom, showPatch, setShowPatch };
}

export type MapSettings = ReturnType<typeof useMapSettings>;
