import { ZARR_STORE } from "@/lib/constants/store";

/** What exports and captions say about the open store. */
export type ActiveSource = {
  title: string;
  url: string;
  variable: string;
  longName: string | null;
  resolutionDeg: number;
  /** "hourly", "6-hourly", "daily", ... */
  stepLabel: string;
};

const FLUXCOM_SOURCE: ActiveSource = {
  title: ZARR_STORE.kicker,
  url: ZARR_STORE.url,
  variable: ZARR_STORE.defaultVariable,
  longName: "Net ecosystem exchange",
  resolutionDeg: ZARR_STORE.spatialResolutionDeg,
  stepLabel: "hourly",
};

let active: ActiveSource = FLUXCOM_SOURCE;

export function setActiveSource(source: ActiveSource | null): void {
  active = source ?? FLUXCOM_SOURCE;
}

export function activeSource(): ActiveSource {
  return active;
}
