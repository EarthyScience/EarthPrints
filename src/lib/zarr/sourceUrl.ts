import { ZARR_STORE } from "@/lib/constants/store";
import type { Dataset } from "@/lib/zarr/dataset";

/** What to open: a store, optionally one array in it and an index per extra axis. */
export type SourceRequest = {
  url: string;
  variable?: string | null;
  /** Index on each extra axis, by dimension name. */
  picks?: Record<string, number>;
};

export const DEFAULT_SOURCE: SourceRequest = {
  url: ZARR_STORE.url,
  variable: ZARR_STORE.defaultVariable,
};

const STORE_PARAM = "store";
const VARIABLE_PARAM = "var";
const PICKS_PARAM = "sel";

/** `ensemble:0,level:3` */
function parsePicks(value: string | null): Record<string, number> {
  const picks: Record<string, number> = {};
  for (const part of (value ?? "").split(",")) {
    const [name, index] = part.split(":");
    const parsed = Number(index);
    if (name && Number.isInteger(parsed) && parsed >= 0) picks[name] = parsed;
  }
  return picks;
}

/** The store in the address bar, so a link opens the same data. */
export function readSourceFromUrl(): SourceRequest {
  if (typeof window === "undefined") return DEFAULT_SOURCE;
  const params = new URLSearchParams(window.location.search);
  const url = params.get(STORE_PARAM);
  if (!url) return DEFAULT_SOURCE;
  return {
    url,
    variable: params.get(VARIABLE_PARAM),
    picks: parsePicks(params.get(PICKS_PARAM)),
  };
}

/**
 * Mirror the open store into the address bar. The default store leaves it
 * clean. `replaceState` keeps the history entry the data view pushed.
 */
export function writeSourceToUrl(
  dataset: Dataset,
  picks: Record<number, number>,
): void {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  const isDefault =
    dataset.url === DEFAULT_SOURCE.url && dataset.variable === DEFAULT_SOURCE.variable;
  url.searchParams.delete(STORE_PARAM);
  url.searchParams.delete(VARIABLE_PARAM);
  url.searchParams.delete(PICKS_PARAM);
  if (!isDefault) {
    url.searchParams.set(STORE_PARAM, dataset.url);
    url.searchParams.set(VARIABLE_PARAM, dataset.variable);
    const sel = dataset.layout.extras
      .filter((dim) => dim.size > 1)
      .map((dim) => `${dim.name}:${picks[dim.axis] ?? 0}`)
      .join(",");
    if (sel) url.searchParams.set(PICKS_PARAM, sel);
  }
  try {
    window.history.replaceState(window.history.state, "", url);
  } catch {
    // Sandboxed frames can refuse; the store still opens.
  }
}

/**
 * Keep the years already picked where the new store has them, otherwise
 * start on its last year.
 */
export function defaultYears(available: number[], current: number[]): number[] {
  const kept = current.filter((year) => available.includes(year));
  if (kept.length > 0) return kept;
  const last = available.at(-1);
  return last === undefined ? [] : [last];
}
