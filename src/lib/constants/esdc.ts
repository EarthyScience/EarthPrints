/** ESDC v3 low-resolution test cube (2.5° × 16-day). */
export const ESDC_TEST_DATASET = {
  id: "esdc-16d-2.5deg",
  label: "ESDC 2.5° (16-day)",
  kicker: "ESDC test cube",
  url: "https://s3.bgc-jena.mpg.de:9000/esdl-esdc-v3.0.2/esdc-16d-2.5deg-46x72x1440-3.0.2.zarr",
  spatialResolutionDeg: 2.5,
  temporalResolutionDays: 16,
  dimensions: {
    time: 989,
    lat: 72,
    lon: 144,
  },
  /** Cell-center coordinates from the published lon/lat arrays. */
  grid: {
    lonStart: -178.75,
    lonStep: 2.5,
    latStart: -88.75,
    latStep: 2.5,
  },
  defaultVariable: "air_temperature_2m",
} as const;

export type EsdcDataset = typeof ESDC_TEST_DATASET;
