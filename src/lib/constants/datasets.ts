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
];
