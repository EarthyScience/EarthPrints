"use client";

import { IconButton } from "@/components/ui/IconButton";
import { MoonIcon } from "@/icons/MoonIcon";
import { SunIcon } from "@/icons/SunIcon";
import { useTheme } from "@/providers/ThemeProvider";

export function ThemeToggle() {
  const { toggleTheme } = useTheme();

  return (
    <IconButton onClick={toggleTheme} aria-label="Toggle theme">
      <SunIcon />
      <MoonIcon />
    </IconButton>
  );
}
