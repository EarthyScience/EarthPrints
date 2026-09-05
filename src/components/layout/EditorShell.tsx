"use client";

import { useRef, useState, type PointerEvent, type ReactNode } from "react";
import { SidebarResizer } from "@/components/layout/SidebarResizer";

/** Id of the mobile controls drawer, for aria-controls on its triggers. */
export const EDITOR_CONTROLS_ID = "editor-controls";

/** Drag distance (px) or flick speed (px/ms) that dismisses the sheet. */
const DISMISS_DISTANCE = 80;
const DISMISS_VELOCITY = 0.5;

type EditorShellProps = {
  header: ReactNode;
  sidebar: ReactNode;
  preview: ReactNode;
  /** Whether the mobile controls drawer is open (<=900px only). */
  controlsOpen: boolean;
  onCloseControls: () => void;
  /** Desktop panel width in px, and whether it is folded away (>=901px only). */
  sidebarWidth: number;
  sidebarCollapsed: boolean;
  onSidebarWidthChange: (width: number) => void;
};

export function EditorShell({
  header,
  sidebar,
  preview,
  controlsOpen,
  onCloseControls,
  sidebarWidth,
  sidebarCollapsed,
  onSidebarWidthChange,
}: EditorShellProps) {
  const drag = useRef<{
    startY: number;
    lastY: number;
    lastT: number;
    v: number;
  } | null>(null);
  const moved = useRef(false);
  const [dragY, setDragY] = useState<number | null>(null);

  const onHandleDown = (event: PointerEvent<HTMLButtonElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      startY: event.clientY,
      lastY: event.clientY,
      lastT: event.timeStamp,
      v: 0,
    };
    moved.current = false;
    setDragY(0);
  };

  const onHandleMove = (event: PointerEvent<HTMLButtonElement>) => {
    const state = drag.current;
    if (!state) return;
    const dy = event.clientY - state.startY;
    if (Math.abs(dy) > 4) moved.current = true;
    const dt = event.timeStamp - state.lastT;
    if (dt > 0) state.v = (event.clientY - state.lastY) / dt;
    state.lastY = event.clientY;
    state.lastT = event.timeStamp;
    // There is nothing above the open position to reveal, so up only rubber-bands.
    setDragY(dy > 0 ? dy : Math.max(-24, dy / 3));
  };

  const onHandleUp = (event: PointerEvent<HTMLButtonElement>) => {
    const state = drag.current;
    drag.current = null;
    setDragY(null);
    if (!state) return;
    const dy = event.clientY - state.startY;
    if (dy > DISMISS_DISTANCE || state.v > DISMISS_VELOCITY) onCloseControls();
  };

  const onHandleClick = () => {
    if (moved.current) return;
    onCloseControls();
  };

  return (
    <div className="editor-shell flex h-dvh flex-col overflow-hidden bg-editor-bg-base text-editor-fg-primary">
      <header className="relative z-[100] flex-shrink-0 overflow-visible bg-editor-bg-base">
        {header}
      </header>
      <div className="relative flex min-h-0 flex-1">
        {/* Backdrop behind the mobile drawer. */}
        <button
          type="button"
          aria-hidden="true"
          tabIndex={-1}
          onClick={onCloseControls}
          className={`fixed inset-0 z-[105] bg-black/40 backdrop-blur-[2px] transition-opacity duration-[380ms] ease-[cubic-bezier(0.22,1,0.36,1)] min-[901px]:hidden ${
            controlsOpen ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
        />
        <aside
          id={EDITOR_CONTROLS_ID}
          className={`editor-sidebar flex flex-shrink-0 flex-col gap-3 overflow-y-auto bg-editor-bg-base p-4 min-[901px]:w-[var(--editor-sidebar-track)] min-[901px]:overflow-hidden min-[901px]:p-0 min-[901px]:transition-[width,visibility] min-[901px]:duration-200 min-[901px]:ease-out min-[901px]:motion-reduce:transition-none max-[900px]:fixed max-[900px]:inset-x-0 max-[900px]:bottom-0 max-[900px]:top-auto max-[900px]:z-[110] max-[900px]:min-w-0 max-[900px]:overflow-x-hidden max-[900px]:overscroll-contain max-[900px]:rounded-t-editor-lg max-[900px]:border-t max-[900px]:border-editor-border max-[900px]:pt-4 max-[900px]:shadow-[0_-12px_40px_rgba(0,0,0,0.28)] max-[900px]:max-h-[80svh] max-[900px]:transition-[translate,opacity,visibility] max-[900px]:duration-[380ms] max-[900px]:ease-[cubic-bezier(0.22,1,0.36,1)] max-[900px]:will-change-[translate] max-[900px]:motion-reduce:transition-none ${
            controlsOpen
              ? "max-[900px]:visible max-[900px]:translate-y-0 max-[900px]:opacity-100"
              : "max-[900px]:invisible max-[900px]:translate-y-full max-[900px]:opacity-0"
          }`}
          style={
            dragY === null
              ? undefined
              : { translate: `0 ${dragY}px`, transition: "none" }
          }
          aria-label="Map controls"
        >
          {/* The contents keep the open width while the panel narrows around
              them, so collapsing slides the panel out instead of reflowing
              every plot inside it on the way. */}
          <div className="flex w-full flex-col gap-3 min-[901px]:h-full min-[901px]:w-[var(--editor-sidebar-width)] min-[901px]:overflow-y-auto min-[901px]:p-4">
            <button
              type="button"
              onClick={onHandleClick}
              onPointerDown={onHandleDown}
              onPointerMove={onHandleMove}
              onPointerUp={onHandleUp}
              onPointerCancel={onHandleUp}
              aria-label="Close time series"
              className="hidden flex-shrink-0 touch-none select-none flex-col items-center gap-2 pb-1 text-[11px] font-medium uppercase tracking-wide text-editor-fg-tertiary transition-colors hover:text-editor-fg-primary active:cursor-grabbing max-[900px]:flex"
            >
              <span
                aria-hidden="true"
                className="h-1 w-9 rounded-full bg-editor-border"
              />
              Time series
            </button>
            {sidebar}
          </div>
        </aside>
        {sidebarCollapsed ? null : (
          <SidebarResizer
            width={sidebarWidth}
            onWidthChange={onSidebarWidthChange}
          />
        )}
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
