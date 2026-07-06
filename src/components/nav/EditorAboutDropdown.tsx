"use client";

import { useEffect, useId, useRef, useState } from "react";
import { AboutContent } from "@/components/about/AboutContent";
import { IconButton } from "@/components/ui/IconButton";
import { QuestionMarkIcon } from "@/icons/QuestionMarkIcon";

export function EditorAboutDropdown() {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [open]);

  return (
    <div className="relative" ref={rootRef}>
      <IconButton
        className="aria-expanded:relative aria-expanded:z-[102]"
        aria-label="About the team"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((current) => !current)}
      >
        <QuestionMarkIcon />
      </IconButton>

      <div
        id={panelId}
        className={`absolute left-auto right-0 top-[calc(100%+2px)] z-[101] box-border w-[min(420px,calc(100vw-24px))] rounded-editor-md border border-editor-border bg-editor-bg-base p-4 shadow-editor transition-[opacity,visibility] duration-[160ms] ${
          open
            ? "pointer-events-auto visible opacity-100"
            : "pointer-events-none invisible opacity-0"
        }`}
        aria-hidden={!open}
      >
        <AboutContent />
      </div>
    </div>
  );
}
