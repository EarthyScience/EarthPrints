import { ZARR_STORE } from "@/lib/constants/store";
import { NATIVE_TIME_CHUNK } from "@/lib/zarr/timeRange";

/**
 * How much of a downloaded patch the reader keeps.
 *
 * A click always downloads a whole 40x40 native chunk, so the window changes
 * what is kept, never what is fetched. Keeping the whole patch makes 1600
 * neighbouring cells free but costs 224 MB per time chunk, which is more than
 * a full history fits in; keeping a tile of it trades free neighbours for a
 * history that stays resident. Sizes divide 40 so the tiles line up with the
 * chunk grid.
 */
export const PATCH_WINDOW_SIZES = [10, 20, 40] as const;

export type PatchWindowSize = (typeof PATCH_WINDOW_SIZES)[number];

/**
 * Desktop default. At 20x20 a full 21-year history is 281 MB, so every year
 * stays cached and the selector's dots stop flickering; 400 cells around the
 * click are still free.
 */
export const DEFAULT_PATCH_WINDOW: PatchWindowSize = 20;

/** Phones and tablets: 70 MB for the same full history. */
export const SMALL_DEVICE_PATCH_WINDOW: PatchWindowSize = 10;

/** Byte budgets for the decoded-patch cache, before the history floor. */
export const DESKTOP_CACHE_BYTES = 1024 ** 3;
export const SMALL_DEVICE_CACHE_BYTES = 384 * 1024 ** 2;

const STORAGE_KEY = "earthprints:patch-window";

const BYTES_PER_VALUE = 4;

/** Bytes one cached entry costs: a full time chunk of a `size` x `size` tile. */
export function entryBytesFor(size: number): number {
  return (
    NATIVE_TIME_CHUNK *
    ZARR_STORE.dimensions.hour *
    size *
    size *
    BYTES_PER_VALUE
  );
}

/** Bytes the whole archive costs at one spot: every time chunk of one tile. */
export function allYearsBytesFor(size: number): number {
  return (
    ZARR_STORE.dimensions.time *
    ZARR_STORE.dimensions.hour *
    size *
    size *
    BYTES_PER_VALUE
  );
}

/**
 * The cache budget to run with.
 *
 * Floored at one spot's full history on purpose: a budget below that evicts
 * the patch it is about to need again, so selecting every year downloads the
 * same chunks over and over and the year dots never settle. The floor costs
 * nothing at 10 or 20, and at 40 it is the honest price of that choice.
 */
export function cacheBytesFor(
  size: number,
  deviceBytes = DESKTOP_CACHE_BYTES,
): number {
  return Math.max(deviceBytes, allYearsBytesFor(size));
}

export function isPatchWindowSize(value: unknown): value is PatchWindowSize {
  return (
    typeof value === "number" &&
    (PATCH_WINDOW_SIZES as readonly number[]).includes(value)
  );
}

type DeviceMemoryNavigator = Navigator & { deviceMemory?: number };

/**
 * Whether to start small. Touch input stands in for "phone or tablet", where
 * the tab is killed outright well below a desktop heap; `deviceMemory` catches
 * low-memory laptops that report a mouse.
 */
export function isSmallDevice(): boolean {
  if (typeof window === "undefined") return false;

  const memory = (window.navigator as DeviceMemoryNavigator | undefined)
    ?.deviceMemory;
  if (typeof memory === "number" && memory > 0 && memory <= 4) return true;

  try {
    return window.matchMedia?.("(pointer: coarse)").matches === true;
  } catch {
    return false;
  }
}

/** Device-chosen default, used until the reader is told otherwise. */
export function defaultPatchWindow(): PatchWindowSize {
  return isSmallDevice() ? SMALL_DEVICE_PATCH_WINDOW : DEFAULT_PATCH_WINDOW;
}

/** Device-chosen budget, before `cacheBytesFor` applies the history floor. */
export function deviceCacheBytes(): number {
  return isSmallDevice() ? SMALL_DEVICE_CACHE_BYTES : DESKTOP_CACHE_BYTES;
}

/** The stored choice, or the device default when there is none to read. */
export function loadPatchWindow(): PatchWindowSize {
  if (typeof window === "undefined") return DEFAULT_PATCH_WINDOW;

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    const parsed = stored === null ? NaN : Number(stored);
    if (isPatchWindowSize(parsed)) return parsed;
  } catch {
    // Private mode, or storage disabled: fall through to the device default.
  }

  return defaultPatchWindow();
}

export function savePatchWindow(size: PatchWindowSize): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(STORAGE_KEY, String(size));
  } catch {
    // Not worth surfacing: the choice still applies for this session.
  }
}

/** Round MB for the menu, so each size states what it costs. */
export function formatBytes(bytes: number): string {
  const mb = bytes / 1024 ** 2;
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${Math.round(mb)} MB`;
}
