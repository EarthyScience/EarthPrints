"use client";

import { Globe, Map } from "lucide-react";
import type { MapViewMode } from "@/types/map";
import { SegmentedTabs } from "@/components/ui/segmented-tabs";

const VIEW_MODES = [
  { value: "2d", label: "Plan", icon: Map },
  { value: "sphere", label: "Sphere", icon: Globe },
] as const;

type ViewModeTabsProps = {
  value: MapViewMode;
  onChange: (mode: MapViewMode) => void;
};

export function ViewModeTabs({ value, onChange }: ViewModeTabsProps) {
  return (
    <SegmentedTabs
      value={value}
      onChange={onChange}
      options={VIEW_MODES}
      aria-label="Map view mode"
    />
  );
}
