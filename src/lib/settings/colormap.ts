import type { Palette } from "@/lib/map/fingerprintScale";

export const COLORMAP_STORAGE_KEY = "earthprints:colormap";

/**
 * Read the stored palette preference, or `null` if none. Any stored diverging
 * table id, including the older "science-light" / "science-dark", means Science.
 */
export function loadPalette(): Palette | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(COLORMAP_STORAGE_KEY);
    if (!stored) return null;
    return stored === "flux" ? "flux" : "science";
  } catch {
    // Private-browsing or quota errors; ignore.
    return null;
  }
}

export function savePalette(palette: Palette): void {
  try {
    localStorage.setItem(COLORMAP_STORAGE_KEY, palette);
  } catch {
    // Ignore storage errors.
  }
}
