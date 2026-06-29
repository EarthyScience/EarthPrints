"use client";

import { useLayoutEffect, useRef, useState } from "react";
import type { MapViewMode } from "@/types/map";

type EditorViewTabsProps = {
  value: MapViewMode;
  onChange: (mode: MapViewMode) => void;
};

const TABS: { id: MapViewMode; label: string }[] = [
  { id: "2d", label: "Plan" },
  { id: "sphere", label: "Sphere" },
];

type IndicatorState = {
  width: number;
  x: number;
};

export function EditorViewTabs({ value, onChange }: EditorViewTabsProps) {
  const tabsRef = useRef<HTMLDivElement>(null);
  const [indicator, setIndicator] = useState<IndicatorState>({ width: 0, x: 0 });

  useLayoutEffect(() => {
    const root = tabsRef.current;
    if (!root) return;

    const measure = () => {
      const active = root.querySelector<HTMLElement>('[aria-selected="true"]');
      if (!active) return;
      setIndicator({
        width: active.offsetWidth,
        x: active.offsetLeft,
      });
    };

    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(root);
    for (const tab of root.querySelectorAll<HTMLElement>(".editor-view-tab")) {
      observer.observe(tab);
    }

    return () => observer.disconnect();
  }, [value]);

  return (
    <div
      ref={tabsRef}
      className="editor-view-tabs"
      role="tablist"
      aria-label="Map view mode"
      style={{ ["--editor-view-tab-count" as string]: TABS.length }}
    >
      <span
        className="editor-view-tabs-indicator"
        aria-hidden="true"
        style={{
          width: indicator.width,
          transform: `translateX(${indicator.x}px)`,
        }}
      />
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={value === tab.id}
          className={`editor-view-tab${value === tab.id ? " active" : ""}`}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
