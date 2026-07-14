"use client";

import { EditorAboutDropdown } from "@/components/nav/EditorAboutDropdown";
import { IconButton } from "@/components/ui/IconButton";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { GitHubIcon } from "@/icons/GitHubIcon";

const REPO_URL = "https://github.com/EarthyScience/EarthPrints";

export function NavActions() {
  return (
    <div className="ml-auto flex items-center gap-2 overflow-visible">
      <IconButton href={REPO_URL} aria-label="View source on GitHub">
        <GitHubIcon />
      </IconButton>
      <EditorAboutDropdown />
      <ThemeToggle />
    </div>
  );
}
