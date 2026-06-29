"use client";

import { Brand } from "@/components/nav/Brand";
import { EditorViewTabs } from "@/components/layout/EditorViewTabs";
import { NavActions } from "@/components/nav/NavActions";
import type { MapViewMode } from "@/types/map";

type NavProps = {
  viewMode?: MapViewMode;
  onViewModeChange?: (mode: MapViewMode) => void;
};

export function Nav({ viewMode = "2d", onViewModeChange }: NavProps) {
  return (
    <nav className="nav nav--editor">
      <div className="nav-inner nav-inner--editor">
        <div className="nav-editor-sidebar-slot">
          <Brand />
        </div>
        <div className="nav-editor-preview-slot">
          {onViewModeChange ? (
            <EditorViewTabs value={viewMode} onChange={onViewModeChange} />
          ) : null}
          <NavActions />
        </div>
      </div>
    </nav>
  );
}
