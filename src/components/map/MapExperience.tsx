"use client";

import dynamic from "next/dynamic";

const EarthMap = dynamic(
  () => import("@/components/map/EarthMap").then((module) => module.EarthMap),
  {
    ssr: false,
    loading: () => (
      <div className="grid h-full min-h-80 place-items-center bg-editor-bg-primary text-editor-fg-tertiary">
        Loading map…
      </div>
    ),
  },
);

export function MapExperience() {
  return <EarthMap />;
}
