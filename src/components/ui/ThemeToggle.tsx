"use client";

import { IconButton } from "@/components/ui/IconButton";
import { MoonIcon } from "@/icons/MoonIcon";
import { SunIcon } from "@/icons/SunIcon";
import { useTheme } from "@/providers/ThemeProvider";

type ThemeToggleProps = {
  className?: string;
};

export function ThemeToggle({ className }: ThemeToggleProps) {
  const { toggleTheme } = useTheme();

  return (
    <IconButton
      onClick={toggleTheme}
      aria-label="Toggle theme"
      className={className}
    >
      <SunIcon />
      <MoonIcon />
    </IconButton>
  );
}
