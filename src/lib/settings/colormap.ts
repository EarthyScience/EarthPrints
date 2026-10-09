import type { Palette } from "@/lib/map/fingerprintScale";

export const COLORMAP_STORAGE_KEY = "earthprints:colormap";

/**
 * Read the stored palette preference, or `null` if none. Older builds stored
 * "science-light" / "science-dark", which both map to Science.
 */
export function loadPalette(): Palette | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(COLORMAP_STORAGE_KEY);
    if (stored === "flux") return "flux";
    if (stored?.startsWith("science")) return "science";
  } catch {
    // Private-browsing or quota errors; ignore.
  }
  return null;
}

export function savePalette(palette: Palette): void {
  try {
    localStorage.setItem(COLORMAP_STORAGE_KEY, palette);
  } catch {
    // Ignore storage errors.
  }
}
