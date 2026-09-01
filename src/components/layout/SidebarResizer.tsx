"use client";

import { useCallback, useEffect, useRef } from "react";
import {
  clampSidebarWidth,
  maxSidebarWidth,
  SIDEBAR_DEFAULT_WIDTH,
  SIDEBAR_MAX_WIDTH,
  SIDEBAR_MIN_WIDTH,
} from "@/lib/sidebar";

/** Arrow keys walk the seam; Shift jumps in bigger steps. */
const KEY_STEP = 16;
const KEY_STEP_LARGE = 64;

type SidebarResizerProps = {
  width: number;
  onWidthChange: (width: number) => void;
};

export function SidebarResizer({ width, onWidthChange }: SidebarResizerProps) {
  // The drag writes straight to the CSS token every frame; React only hears
  // the final width on pointerup, so a drag costs no re-renders.
  const frameRef = useRef<number | null>(null);
  const pendingRef = useRef(width);
  const draggingRef = useRef(false);

  const flush = useCallback(() => {
    frameRef.current = null;
    document.documentElement.style.setProperty(
      "--editor-sidebar-width",
      `${pendingRef.current}px`,
    );
  }, []);

  const schedule = useCallback(
    (next: number) => {
      pendingRef.current = next;
      if (frameRef.current !== null) return;
      frameRef.current = requestAnimationFrame(flush);
    },
    [flush],
  );

  useEffect(() => {
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      document.documentElement.removeAttribute("data-sidebar-resizing");
    };
  }, []);

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      draggingRef.current = true;
      pendingRef.current = width;
      document.documentElement.setAttribute("data-sidebar-resizing", "true");
    },
    [width],
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!draggingRef.current) return;
      // The panel starts at the viewport's left edge, so the pointer's own x
      // is the width. No grab offset to carry: the seam sits on the edge it
      // moves, and snapping it under the cursor is the behaviour people
      // expect from a splitter.
      schedule(clampSidebarWidth(event.clientX, window.innerWidth));
    },
    [schedule],
  );

  const endDrag = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      document.documentElement.removeAttribute("data-sidebar-resizing");
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        flush();
      }
      onWidthChange(pendingRef.current);
    },
    [flush, onWidthChange],
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      const step = event.shiftKey ? KEY_STEP_LARGE : KEY_STEP;
      let next: number | null = null;
      if (event.key === "ArrowLeft") next = width - step;
      else if (event.key === "ArrowRight") next = width + step;
      else if (event.key === "Home") next = SIDEBAR_MIN_WIDTH;
      else if (event.key === "End") next = maxSidebarWidth(window.innerWidth);
      else if (event.key === "Enter" || event.key === " ") {
        next = SIDEBAR_DEFAULT_WIDTH;
      }
      if (next === null) return;
      event.preventDefault();
      onWidthChange(clampSidebarWidth(next, window.innerWidth));
    },
    [onWidthChange, width],
  );

  const handleDoubleClick = useCallback(() => {
    onWidthChange(clampSidebarWidth(SIDEBAR_DEFAULT_WIDTH, window.innerWidth));
  }, [onWidthChange]);

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize panel"
      aria-valuenow={width}
      aria-valuemin={SIDEBAR_MIN_WIDTH}
      aria-valuemax={SIDEBAR_MAX_WIDTH}
      tabIndex={0}
      title="Drag to resize. Double-click to reset."
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onKeyDown={handleKeyDown}
      onDoubleClick={handleDoubleClick}
      className="group absolute inset-y-0 left-[var(--editor-sidebar-track)] z-30 hidden w-[9px] -translate-x-1/2 cursor-col-resize touch-none focus:outline-none min-[901px]:block"
    >
      {/* The hit area is wide; the line that lights up is one pixel of it. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-accent opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
      />
    </div>
  );
}
