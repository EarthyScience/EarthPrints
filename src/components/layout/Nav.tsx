"use client";

import { Brand } from "@/components/nav/Brand";
import { EditorViewTabs } from "@/components/layout/EditorViewTabs";
import { NavActions } from "@/components/nav/NavActions";
import { IconButton } from "@/components/ui/IconButton";
import { CrosshairIcon } from "@/icons/CrosshairIcon";
import type { MapViewMode } from "@/types/map";

type NavProps = {
  viewMode?: MapViewMode;
  onViewModeChange?: (mode: MapViewMode) => void;
  hasSelection?: boolean;
  onZoomToSelection?: () => void;
};

export function Nav({
  viewMode = "2d",
  onViewModeChange,
  hasSelection = false,
  onZoomToSelection,
}: NavProps) {
  return (
    <nav className="relative z-[100] flex w-full flex-col gap-0 overflow-visible">
      <div className="relative z-[2] box-border grid h-12 w-full grid-cols-[var(--editor-sidebar-width)_1fr] items-center gap-0 overflow-visible rounded-none border-0 bg-transparent p-0">
        <div className="box-border flex min-w-0 items-center px-4 py-2">
          <Brand />
        </div>
        <div className="box-border flex min-w-0 items-center bg-editor-bg-base py-2 pl-0 pr-2">
          <div className="mr-auto flex flex-shrink-0 items-center gap-1.5">
            {onViewModeChange ? (
              <EditorViewTabs value={viewMode} onChange={onViewModeChange} />
            ) : null}
            {hasSelection && onZoomToSelection ? (
              <IconButton
                className="animate-[zoomToSelectionIn_0.18s_cubic-bezier(0.16,1,0.3,1)]"
                aria-label="Zoom to selection"
                onClick={onZoomToSelection}
              >
                <CrosshairIcon />
              </IconButton>
            ) : null}
          </div>
          <NavActions />
        </div>
      </div>
    </nav>
  );
}
