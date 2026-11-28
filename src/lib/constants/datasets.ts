import { ZARR_STORE } from "@/lib/constants/store";
import type { SourceRequest } from "@/lib/zarr/sourceUrl";

export type DatasetPreset = SourceRequest & {
  label: string;
  description: string;
};

/** Stores known to open, offered so nobody has to find a URL first. */
export const DATASET_PRESETS: DatasetPreset[] = [
  {
    label: "FLUXCOM-X-BASE NEE",
    description: "Net ecosystem exchange, hourly, 0.05°, 2001 to 2021",
    url: ZARR_STORE.url,
    variable: ZARR_STORE.defaultVariable,
  },
  {
    label: "ACE2S HiRO v2, 2023",
    description: "AI climate emulator, 6-hourly, 0.03°, one ensemble member",
    url: "https://huggingface.co/buckets/allenai/ai2cm-xshield/resolve/hirov2/2026-08-05-global-hirov2-ace2s-2023.zarr",
    variable: "PRMSL",
  },
  {
    label: "ESDC 8-daily, air temperature",
    description: "Earth System Data Cube, 8-daily, 0.25°, 1979 to 2021",
    url: "https://s3.bgc-jena.mpg.de:9000/esdl-esdc-v3.0.2/esdc-8d-0.25deg-256x128x128-3.0.2.zarr",
    variable: "air_temperature_2m",
  },
  {
    label: "CESM2 historical, monthly",
    description: "CMIP6 air temperature, monthly, 1.25°, 1850 to 2014, no leap years",
    url: "https://storage.googleapis.com/cmip6/CMIP6/CMIP/NCAR/CESM2/historical/r1i1p1f1/Amon/tas/gn/v20190308",
    variable: "tas",
  },
  {
    label: "CESM2 pre-industrial control",
    description: "CMIP6 air temperature, monthly, 1.25°, model years 1 to 1200",
    url: "https://storage.googleapis.com/cmip6/CMIP6/CMIP/NCAR/CESM2/piControl/r1i1p1f1/Amon/tas/gn/v20190320",
    variable: "tas",
  },
  {
    label: "HadGEM3 historical, daily",
    description: "CMIP6 air temperature, daily, 1.88°, 1850 to 2014, 360-day years",
    url: "https://storage.googleapis.com/cmip6/CMIP6/CMIP/MOHC/HadGEM3-GC31-LL/historical/r1i1p1f3/day/tas/gn/v20190624",
    variable: "tas",
  },
  {
    label: "GFDL-CM4 historical, 3-hourly",
    description: "CMIP6 sunlight reaching the surface, 3-hourly, 2.5°, 1960 to 2014",
    url: "https://storage.googleapis.com/cmip6/CMIP6/CMIP/NOAA-GFDL/GFDL-CM4/historical/r1i1p1f1/3hr/rsds/gr2/v20180701",
    variable: "rsds",
  },
  {
    label: "CanESM5 historical, monthly",
    description: "CMIP6 air temperature, monthly, 2.81° Gaussian grid, 1850 to 2014",
    url: "https://storage.googleapis.com/cmip6/CMIP6/CMIP/CCCma/CanESM5/historical/r1i1p1f1/Amon/tas/gn/v20190429",
    variable: "tas",
  },
  {
    label: "MUR sea surface temperature",
    description: "Ocean only, daily, 0.01°, 2002 to 2020",
    url: "https://mur-sst.s3.us-west-2.amazonaws.com/zarr-v1",
    variable: "analysed_sst",
  },
  {
    label: "NOAA GFS analysis",
    description: "Air temperature, hourly, 0.25°, 2021 to now, sharded Zarr v3",
    url: "https://data.dynamical.org/noaa/gfs/analysis/latest.zarr",
    variable: "temperature_2m",
  },
  {
    label: "NASA POWER, monthly",
    description: "MERRA-2 air temperature, monthly, 0.625°, 1981 on",
    url: "https://nasa-power.s3.amazonaws.com/merra2/temporal/power_merra2_monthly_temporal_utc.zarr",
    variable: "T2M",
  },
];
