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
    <div className="editor-about-dropdown" ref={rootRef}>
      <IconButton
        className="editor-about-trigger"
        aria-label="About the team"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((current) => !current)}
      >
        <QuestionMarkIcon />
      </IconButton>

      <div
        id={panelId}
        className={`editor-about-panel${open ? " open" : ""}`}
        aria-hidden={!open}
      >
        <AboutContent />
      </div>
    </div>
  );
}
