"use client";

import { Brand } from "@/components/nav/Brand";
import { EDITOR_CONTROLS_ID } from "@/components/layout/EditorShell";
import { EditorViewTabs } from "@/components/layout/EditorViewTabs";
import { NavActions } from "@/components/nav/NavActions";
import { IconButton } from "@/components/ui/IconButton";
import { AutoZoomIcon } from "@/icons/AutoZoomIcon";
import { CrosshairIcon } from "@/icons/CrosshairIcon";
import { PanelLeftIcon } from "@/icons/PanelLeftIcon";
import { PatchIcon } from "@/icons/PatchIcon";
import type { MapViewMode } from "@/types/map";

type NavProps = {
  viewMode?: MapViewMode;
  onViewModeChange?: (mode: MapViewMode) => void;
  hasSelection?: boolean;
  onZoomToSelection?: () => void;
  autoZoom?: boolean;
  onToggleAutoZoom?: () => void;
  showPatch?: boolean;
  onTogglePatch?: () => void;
  /** Desktop side panel state (>=901px only). */
  sidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
};

export function Nav({
  viewMode = "2d",
  onViewModeChange,
  hasSelection = false,
  onZoomToSelection,
  autoZoom = true,
  onToggleAutoZoom,
  showPatch = false,
  onTogglePatch,
  sidebarCollapsed = false,
  onToggleSidebar,
}: NavProps) {
  return (
    <nav className="relative z-[100] flex w-full flex-col gap-0 overflow-visible">
      <div className="relative z-[2] box-border grid h-12 w-full grid-cols-[minmax(var(--editor-sidebar-track),max-content)_1fr] items-center max-[900px]:grid-cols-[auto_1fr] gap-0 overflow-visible rounded-none border-0 bg-transparent p-0">
        <div className="box-border flex min-w-0 items-center gap-2 px-4 py-2">
          <Brand />
        </div>
        <div className="box-border flex min-w-0 items-center bg-editor-bg-base py-2 pl-0 pr-2">
          <div
            className="mr-auto flex flex-shrink-0 items-center gap-1.5"
            data-tour="controls"
          >
            {/* On mobile (<=900px) the view toggle and these controls move to
                the map's floating side panels. */}
            {onToggleSidebar ? (
              <IconButton
                className="max-[900px]:hidden"
                aria-label={sidebarCollapsed ? "Show panel" : "Hide panel"}
                aria-expanded={!sidebarCollapsed}
                aria-controls={EDITOR_CONTROLS_ID}
                onClick={onToggleSidebar}
              >
                <PanelLeftIcon />
              </IconButton>
            ) : null}
            {onViewModeChange ? (
              <div className="max-[900px]:hidden">
                <EditorViewTabs value={viewMode} onChange={onViewModeChange} />
              </div>
            ) : null}
            <div className="flex items-center gap-1.5 max-[900px]:hidden">
              {hasSelection && onZoomToSelection ? (
                <IconButton
                  className="animate-[zoomToSelectionIn_0.18s_cubic-bezier(0.16,1,0.3,1)]"
                  aria-label="Zoom to selection"
                  onClick={onZoomToSelection}
                >
                  <CrosshairIcon />
                </IconButton>
              ) : null}
              {onToggleAutoZoom ? (
                <IconButton
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
              {hasSelection && onTogglePatch ? (
                <IconButton
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
              ) : null}
            </div>
          </div>
          <NavActions />
        </div>
      </div>
    </nav>
  );
}
