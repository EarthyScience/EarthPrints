"use client";

import { EditorAboutDropdown } from "@/components/nav/EditorAboutDropdown";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

export function NavActions() {
  return (
    <div className="ml-auto flex items-center gap-2 overflow-visible">
      <EditorAboutDropdown />
      <ThemeToggle />
    </div>
  );
}
