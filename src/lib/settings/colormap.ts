import type { ColormapId } from "@/lib/map/fingerprintScale";

export const COLORMAP_STORAGE_KEY = "earthprints:colormap";

/**
 * Read the stored colormap preference. Falls back to `null` so callers can
 * decide their own default (typically the active theme's built-in palette).
 */
export function loadColormap(): ColormapId | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(COLORMAP_STORAGE_KEY);
    if (
      stored === "science-light" ||
      stored === "science-dark" ||
      stored === "flux"
    ) {
      return stored;
    }
  } catch {
    // Private-browsing or quota errors; ignore.
  }
  return null;
}

/** Persist the selected colormap. */
export function saveColormap(id: ColormapId): void {
  try {
    localStorage.setItem(COLORMAP_STORAGE_KEY, id);
  } catch {
    // Ignore storage errors.
  }
}
