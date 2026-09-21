"use client";

import { useEffect, useRef, useState } from "react";
import {
  COLORMAPS,
  type ColormapId,
  fingerprintRampGradient,
} from "@/lib/map/fingerprintScale";

type ColormapPickerProps = {
  value: ColormapId;
  onChange: (id: ColormapId) => void;
};

const COLORMAP_IDS = Object.keys(COLORMAPS) as ColormapId[];

/**
 * Swatch gradient for one palette, sampled from the actual scale function (the
 * same helper the colorbar uses) so a swatch never misrepresents its map.
 *
 * Extents are symmetric here (negMax = posMax = 1, zero at 50%) because the
 * swatch is a palette preview, not tied to any real dataset range.
 */
const SWATCH_GRADIENTS = Object.fromEntries(
  COLORMAP_IDS.map((id) => [id, fingerprintRampGradient(id, 1, 1, 16)]),
) as Record<ColormapId, string>;

/**
 * Palette selector for the fingerprint heatmap. This is a dropdown rather than
 * a row of buttons because the list outgrew the sidebar's width; the swatches
 * are the point, since the maps differ in ways their names do not convey.
 */
export function ColormapPicker({ value, onChange }: ColormapPickerProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className="flex items-center gap-2">
      <span className="shrink-0 text-[11.5px] font-semibold text-editor-fg-tertiary">
        Palette
      </span>
      <div ref={containerRef} className="relative inline-flex items-center">
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          aria-expanded={open}
          aria-haspopup="menu"
          title={COLORMAPS[value].description}
          className="flex items-center gap-1.5 rounded-md border border-editor-border px-2 py-0.5 text-[11.5px] font-semibold text-editor-fg-secondary transition-colors hover:border-editor-border-strong hover:text-editor-fg-primary"
        >
          <span
            className="block h-2.5 w-9 shrink-0 rounded-sm"
            style={{ background: SWATCH_GRADIENTS[value] }}
            aria-hidden="true"
          />
          <span>{COLORMAPS[value].label}</span>
        </button>

        {open ? (
          <div
            role="menu"
            className="absolute left-0 top-full z-50 mt-1.5 w-56 rounded-lg border border-editor-border bg-editor-bg-primary p-1 shadow-lg backdrop-blur-md"
          >
            {COLORMAP_IDS.map((id) => {
              const active = id === value;
              return (
                <button
                  key={id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={active}
                  title={COLORMAPS[id].description}
                  onClick={() => {
                    onChange(id);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] font-medium hover:bg-editor-bg-secondary hover:text-editor-fg-primary ${
                    active
                      ? "text-editor-fg-primary"
                      : "text-editor-fg-secondary"
                  }`}
                >
                  <span
                    className="block h-2.5 w-14 shrink-0 rounded-sm"
                    style={{ background: SWATCH_GRADIENTS[id] }}
                    aria-hidden="true"
                  />
                  <span className="flex-1">{COLORMAPS[id].label}</span>
                  {active ? (
                    <span className="font-mono text-[10px] text-accent">●</span>
                  ) : null}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}
