"use client";

import { useEffect, useId, useRef, useState } from "react";
import { IconButton } from "@/components/ui/IconButton";
import { PatchIcon } from "@/icons/PatchIcon";
import {
  allYearsBytesFor,
  formatBytes,
  PATCH_WINDOW_SIZES,
  type PatchWindowSize,
} from "@/lib/settings/patchWindow";

type PatchMenuProps = {
  showPatch: boolean;
  onTogglePatch: () => void;
  windowSize: PatchWindowSize;
  onWindowSizeChange: (size: PatchWindowSize) => void;
  placement?: "bottom" | "left";
  variant?: "default" | "plain";
  className?: string;
};

export function PatchMenu({
  showPatch,
  onTogglePatch,
  windowSize,
  onWindowSizeChange,
  placement = "bottom",
  variant = "default",
  className = "",
}: PatchMenuProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [open]);

  // Arrow keys walk the rows once the menu is open, as a menu is expected to.
  const onPanelKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();

    const rows = Array.from(
      panelRef.current?.querySelectorAll<HTMLButtonElement>("button") ?? [],
    );
    if (rows.length === 0) return;

    const current = rows.indexOf(document.activeElement as HTMLButtonElement);
    const step = event.key === "ArrowDown" ? 1 : -1;
    const next = (current + step + rows.length) % rows.length;
    rows[next]?.focus();
  };

  return (
    <div className={`relative ${className}`} ref={rootRef}>
      <IconButton
        className="aria-expanded:relative aria-expanded:z-[102]"
        variant={variant}
        tooltip="Downloaded patch"
        tooltipPlacement={placement === "left" ? "left" : "bottom"}
        aria-label="Downloaded patch options"
        aria-expanded={open}
        aria-controls={panelId}
        aria-pressed={showPatch}
        onClick={() => setOpen((current) => !current)}
      >
        <PatchIcon />
      </IconButton>

      <div
        id={panelId}
        ref={panelRef}
        role="menu"
        aria-hidden={!open}
        onKeyDown={onPanelKeyDown}
        className={`absolute z-[101] box-border w-[248px] rounded-editor-md border border-editor-border bg-editor-bg-base p-1 shadow-editor transition-[opacity,visibility] duration-[160ms] ${
          placement === "left"
            ? "right-[calc(100%+8px)] top-1/2 -translate-y-1/2"
            : "left-auto right-0 top-[calc(100%+2px)]"
        } ${
          open
            ? "pointer-events-auto visible opacity-100"
            : "pointer-events-none invisible opacity-0"
        }`}
      >
        <button
          type="button"
          role="menuitemcheckbox"
          aria-checked={showPatch}
          tabIndex={open ? 0 : -1}
          className={`flex w-full items-center gap-2 rounded-editor-sm px-2 py-1.5 text-left text-[12.5px] text-editor-fg-secondary transition-colors hover:bg-editor-bg-secondary hover:text-editor-fg-primary ${
            showPatch
              ? "bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] text-accent hover:bg-[color-mix(in_srgb,var(--accent)_16%,transparent)] hover:text-accent"
              : ""
          }`}
          onClick={onTogglePatch}
        >
          <span
            className={`size-1.5 shrink-0 rounded-full ${showPatch ? "bg-accent" : "bg-transparent"}`}
            aria-hidden="true"
          />
          Show patch on map
        </button>

        <div role="separator" className="my-1 h-px bg-editor-border" aria-hidden="true" />

        <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-editor-fg-tertiary">Cells kept per download</p>

        {PATCH_WINDOW_SIZES.map((size) => {
          const active = size === windowSize;
          return (
            <button
              key={size}
              type="button"
              role="menuitemradio"
              aria-checked={active}
              tabIndex={open ? 0 : -1}
              className={`flex w-full items-center gap-2 rounded-editor-sm px-2 py-1.5 text-left text-[12.5px] text-editor-fg-secondary transition-colors hover:bg-editor-bg-secondary hover:text-editor-fg-primary ${
                active
                  ? "bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] text-accent hover:bg-[color-mix(in_srgb,var(--accent)_16%,transparent)] hover:text-accent"
                  : ""
              }`}
              onClick={() => {
                onWindowSizeChange(size);
                setOpen(false);
              }}
            >
              <span
                className={`size-1.5 shrink-0 rounded-full ${active ? "bg-accent" : "bg-transparent"}`}
                aria-hidden="true"
              />
              <span className="flex-1">
                {size} x {size}
              </span>
              <span className="text-[11.5px] tabular-nums text-editor-fg-tertiary">
                {formatBytes(allYearsBytesFor(size))}
              </span>
            </button>
          );
        })}

        <p className="px-2 pb-1 pt-1.5 text-[11.5px] leading-snug text-editor-fg-tertiary">
          A click downloads a 40 x 40 patch either way. This sets how much of it
          is kept, and what every year of it costs in memory.
        </p>
      </div>
    </div>
  );
}
