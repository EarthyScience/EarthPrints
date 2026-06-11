import type { HeroCopy, HeroReadout } from "@/types/hero";

export const HERO_COPY: HeroCopy = {
  chip: "Global data",
  meta: "Near real-time",
  titleLine1: "Explore the planet,",
  titleLine2: "pixel by",
  accentWord: "pixel.",
  subtitle:
    "Climate fingerprints and flux-tower footprints, rendered live in your browser. Every variable, every cell, down to the square kilometre.",
};

export const HERO_READOUT: HeroReadout = {
  proj: "equirectangular",
  var: "surface_temp · 0.05°",
  epoch: "2024-08 · v0.9",
};
