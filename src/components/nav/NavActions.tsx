"use client";

import { EditorAboutDropdown } from "@/components/nav/EditorAboutDropdown";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

export function NavActions() {
  return (
    <div className="nav-right">
      <EditorAboutDropdown />
      <ThemeToggle />
    </div>
  );
}
