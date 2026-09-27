"use client";

import dynamic from "next/dynamic";

const ReliefMap = dynamic(
  () => import("@/components/map/ReliefMap").then((module) => module.ReliefMap),
  {
    ssr: false,
    loading: () => (
      <div className="grid h-dvh min-h-80 place-items-center bg-editor-bg-primary text-editor-fg-tertiary">
        Loading map…
      </div>
    ),
  },
);

export function MapExperience() {
  return <ReliefMap />;
}
