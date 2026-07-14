/** ESDC v3 low-resolution test cube (2.5° × 16-day). */
export const ZARR_STORE = {
  id: "nee-d-0.05deg",
  label: "NEE 0.05° (hourly)",
  kicker: "FLUXCOM-X NEE",
  url: "https://swift.dkrz.de/v1/dkrz_a1e106384d7946408b9724b59858a536/fluxcom-x/FLUXCOMxBase/NEE",
  spatialResolutionDeg: 0.05,
  temporalResolutionDays: 1, /** Hourly. */
  dimensions: {
    time: 7670,
    hour: 24,
    lon: 7200,
    lat: 3600,
  },
  /** Cell-center coordinates from the published lon/lat arrays. */
  grid: {
    lonStart: -179.975,
    lonStep: 0.05,
    latStart: 89.975,
    latStep: -0.05,
  },
  /**
   * On-disk chunk footprint along lat/lon. A click downloads this whole
   * patch (40 x 40 cells = 2° x 2°), not a single pixel. Matches the store's
   * `chunks` metadata `[1461, 24, 40, 40]`.
   */
  nativeChunks: {
    lat: 40,
    lon: 40,
  },
  defaultVariable: "NEE",
} as const;

export type ZarrDataset = typeof ZARR_STORE;
