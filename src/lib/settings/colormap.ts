import { COLORMAPS, type ColormapId } from "@/lib/map/fingerprintScale";

export const COLORMAP_STORAGE_KEY = "earthprints:colormap";

/**
 * Palette ids that shipped before the Crameri lookup tables landed. The two
 * "science" maps were hand-rolled three-stop approximations of vik and berlin,
 * so a stored preference carries forward to the real table rather than being
 * dropped back to the default.
 */
const RENAMED: Record<string, ColormapId> = {
  "science-light": "vik",
  "science-dark": "berlin",
};

function asColormapId(stored: string | null): ColormapId | null {
  if (!stored) return null;
  if (stored in RENAMED) return RENAMED[stored];
  return stored in COLORMAPS ? (stored as ColormapId) : null;
}

/**
 * Read the stored colormap preference. Falls back to `null` so callers can
 * decide their own default (typically the active theme's built-in palette).
 */
export function loadColormap(): ColormapId | null {
  if (typeof window === "undefined") return null;
  try {
    return asColormapId(localStorage.getItem(COLORMAP_STORAGE_KEY));
  } catch {
    // Private-browsing or quota errors; ignore.
    return null;
  }
}

/** Persist the selected colormap. */
export function saveColormap(id: ColormapId): void {
  try {
    localStorage.setItem(COLORMAP_STORAGE_KEY, id);
  } catch {
    // Ignore storage errors.
  }
}
