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
    for (const tab of root.querySelectorAll<HTMLElement>('[role="tab"]')) {
      observer.observe(tab);
    }

    return () => observer.disconnect();
  }, [value]);

  return (
    <div
      ref={tabsRef}
      className="relative isolate grid h-8 min-w-[148px] items-center gap-0 grid-cols-[repeat(var(--editor-view-tab-count),minmax(72px,1fr))] box-border rounded-editor-sm border border-editor-border bg-editor-bg-primary p-[3px]"
      role="tablist"
      aria-label="Map view mode"
      style={{ ["--editor-view-tab-count" as string]: TABS.length }}
    >
      <span
        className="pointer-events-none absolute left-0 top-[3px] z-0 h-6 rounded-[6px] border border-[color-mix(in_srgb,var(--accent)_40%,transparent)] bg-[color-mix(in_srgb,var(--accent)_14%,transparent)] transition-[transform,width] duration-[320ms] ease-[cubic-bezier(0.16,1,0.3,1)] will-change-[transform,width]"
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
          className="relative z-[1] box-border inline-flex h-[26px] w-full min-w-0 cursor-pointer items-center justify-center rounded-none border-0 bg-transparent px-3 text-xs font-semibold leading-none tracking-[-0.01em] text-editor-fg-primary focus-visible:outline-offset-1 focus-visible:[outline:2px_solid_var(--accent-solid)]"
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
