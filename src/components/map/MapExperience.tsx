"use client";

import dynamic from "next/dynamic";

const EarthMap = dynamic(
  () => import("@/components/map/EarthMap").then((module) => module.EarthMap),
  {
    ssr: false,
    loading: () => <div className="map-loading">Loading map…</div>,
  },
);

export function MapExperience() {
  return <EarthMap />;
}
