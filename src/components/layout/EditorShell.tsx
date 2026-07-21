"use client";

import type { ReactNode } from "react";
import { IconButton } from "@/components/ui/IconButton";
import { MenuIcon } from "@/icons/MenuIcon";

type EditorShellProps = {
  header: ReactNode;
  sidebar: ReactNode;
  preview: ReactNode;
  /** Whether the mobile controls drawer is open (<=900px only). */
  controlsOpen: boolean;
  onCloseControls: () => void;
};

export function EditorShell({
  header,
  sidebar,
  preview,
  controlsOpen,
  onCloseControls,
}: EditorShellProps) {
  return (
    <div className="editor-shell flex h-dvh flex-col bg-editor-bg-base text-editor-fg-primary [--editor-sidebar-width:min(400px,36vw)]">
      <header className="relative z-[100] flex-shrink-0 overflow-visible bg-editor-bg-base">
        {header}
      </header>
      <div className="flex min-h-0 flex-1">
        {/* Backdrop behind the mobile drawer. */}
        <button
          type="button"
          aria-hidden="true"
          tabIndex={-1}
          onClick={onCloseControls}
          className={`fixed inset-0 z-[105] bg-black/40 transition-opacity duration-300 min-[901px]:hidden ${
            controlsOpen
              ? "opacity-100"
              : "pointer-events-none opacity-0"
          }`}
        />
        <aside
          className={`flex w-[var(--editor-sidebar-width)] flex-shrink-0 flex-col gap-3 overflow-y-auto bg-editor-bg-base p-4 max-[900px]:fixed max-[900px]:inset-0 max-[900px]:z-[110] max-[900px]:w-full max-[900px]:transition-[transform,visibility] max-[900px]:duration-300 max-[900px]:ease-[cubic-bezier(0.16,1,0.3,1)] ${
            controlsOpen
              ? "max-[900px]:visible max-[900px]:translate-x-0"
              : "max-[900px]:invisible max-[900px]:-translate-x-full"
          }`}
          aria-label="Map controls"
        >
          {/* Drawer header — mobile only. */}
          <div className="hidden items-center justify-between max-[900px]:flex">
            <h2 className="text-[15px] font-semibold tracking-[-0.02em] text-editor-fg-primary">
              Controls
            </h2>
            <IconButton
              variant="plain"
              aria-label="Close controls"
              onClick={onCloseControls}
            >
              <MenuIcon open />
            </IconButton>
          </div>
          {sidebar}
        </aside>
        <div className="flex min-w-0 flex-1 bg-editor-bg-base pb-2 pr-2 max-[900px]:px-2 max-[900px]:pb-2">
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-editor-lg border border-editor-border bg-editor-bg-primary">
            <div className="relative isolate min-h-0 flex-1 overflow-hidden rounded-[inherit]">
              {preview}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
