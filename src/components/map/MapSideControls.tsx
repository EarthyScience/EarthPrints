"use client";

import { IconButton } from "@/components/ui/IconButton";
import { AutoZoomIcon } from "@/icons/AutoZoomIcon";
import { CrosshairIcon } from "@/icons/CrosshairIcon";
import { FingerprintIcon } from "@/icons/FingerprintIcon";
import { GlobeIcon } from "@/icons/GlobeIcon";
import { MapIcon } from "@/icons/MapIcon";
import { PatchIcon } from "@/icons/PatchIcon";
import type { MapViewMode } from "@/types/map";

type MapSideControlsProps = {
  viewMode: MapViewMode;
  onViewModeChange: (mode: MapViewMode) => void;
  hasSelection: boolean;
  onZoomToSelection: () => void;
  autoZoom?: boolean;
  onToggleAutoZoom?: () => void;
  showPatch: boolean;
  onTogglePatch: () => void;
  controlsOpen: boolean;
  onToggleControls: () => void;
  controlsId: string;
};

const ISLAND_CLASS =
  "pointer-events-auto flex flex-col items-center gap-1.5 rounded-editor-sm " +
  "border border-editor-border bg-editor-bg-base p-1.5 shadow-editor";

// Mobile-only counterpart to the header nav controls. On narrow layouts
// (<=900px, matching EditorShell's stacking breakpoint) the view toggle and the
// crosshair/patch controls move out of the header and float against the right
// edge of the map as stacked "islands", mirroring the issue #49 mockup. The
// last island opens the readout drawer, replacing the header hamburger; like
// the crosshair/patch island it only appears once a cell has been picked, since
// there is nothing to read out before then.
export function MapSideControls({
  viewMode,
  onViewModeChange,
  hasSelection,
  onZoomToSelection,
  autoZoom = true,
  onToggleAutoZoom,
  showPatch,
  onTogglePatch,
  controlsOpen,
  onToggleControls,
  controlsId,
}: MapSideControlsProps) {
  return (
    <div
      className="pointer-events-none absolute right-3 top-1/2 z-20 hidden -translate-y-1/2 flex-col items-end gap-2 max-[900px]:flex"
      data-tour="controls-mobile"
    >
      <div className={ISLAND_CLASS}>
        <IconButton
          variant="plain"
          tooltipPlacement="left"
          aria-label="Plan view"
          aria-pressed={viewMode === "2d"}
          onClick={() => onViewModeChange("2d")}
        >
          <MapIcon />
        </IconButton>
        <IconButton
          variant="plain"
          tooltipPlacement="left"
          aria-label="Sphere view"
          aria-pressed={viewMode === "sphere"}
          onClick={() => onViewModeChange("sphere")}
        >
          <GlobeIcon />
        </IconButton>
      </div>
      {hasSelection ? (
        <>
          <div className={ISLAND_CLASS}>
            <IconButton
              variant="plain"
              tooltipPlacement="left"
              className="animate-[zoomToSelectionIn_0.18s_cubic-bezier(0.16,1,0.3,1)]"
              aria-label="Zoom to selection"
              onClick={onZoomToSelection}
            >
              <CrosshairIcon />
            </IconButton>
            {onToggleAutoZoom ? (
              <IconButton
                variant="plain"
                tooltipPlacement="left"
                className="animate-[zoomToSelectionIn_0.18s_cubic-bezier(0.16,1,0.3,1)]"
                aria-label={
                  autoZoom
                    ? "Disable auto-zoom on selection"
                    : "Enable auto-zoom on selection"
                }
                tooltip={
                  autoZoom
                    ? "Auto-zoom on select: On"
                    : "Auto-zoom on select: Off"
                }
                aria-pressed={autoZoom}
                onClick={onToggleAutoZoom}
              >
                <AutoZoomIcon />
              </IconButton>
            ) : null}
            <IconButton
              variant="plain"
              tooltipPlacement="left"
              className="animate-[zoomToSelectionIn_0.18s_cubic-bezier(0.16,1,0.3,1)]"
              aria-label={
                showPatch
                  ? "Hide downloaded patch extent"
                  : "Show downloaded patch extent"
              }
              aria-pressed={showPatch}
              onClick={onTogglePatch}
            >
              <PatchIcon />
            </IconButton>
          </div>
          <div className={ISLAND_CLASS}>
            <IconButton
              variant="plain"
              tooltipPlacement="left"
              className="animate-[zoomToSelectionIn_0.18s_cubic-bezier(0.16,1,0.3,1)]"
              data-tour="panel-toggle"
              aria-label={controlsOpen ? "Hide time series" : "Show time series"}
              aria-expanded={controlsOpen}
              aria-controls={controlsId}
              aria-pressed={controlsOpen}
              onClick={onToggleControls}
            >
              <FingerprintIcon />
            </IconButton>
          </div>
        </>
      ) : null}
    </div>
  );
}
