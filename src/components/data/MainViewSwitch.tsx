"use client";

import { ChartColumn, Globe } from "lucide-react";
import { SegmentedTabs } from "@/components/ui/segmented-tabs";

export type MainView = "map" | "data";

const MAIN_VIEWS = [
  { value: "map", label: "Map", icon: Globe },
  { value: "data", label: "Data", icon: ChartColumn },
] as const;

type MainViewSwitchProps = {
  value: MainView;
  onChange: (view: MainView) => void;
};

export function MainViewSwitch({ value, onChange }: MainViewSwitchProps) {
  return (
    <SegmentedTabs
      value={value}
      onChange={onChange}
      options={MAIN_VIEWS}
      aria-label="Main view"
      className="shrink-0"
    />
  );
}
