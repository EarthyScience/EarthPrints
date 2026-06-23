"use client";

import { IconButton } from "@/components/ui/IconButton";
import { MenuIcon } from "@/icons/MenuIcon";

type MobileMenuButtonProps = {
  open: boolean;
  onToggle: () => void;
  controlsId: string;
  className?: string;
};

export function MobileMenuButton({
  open,
  onToggle,
  controlsId,
  className,
}: MobileMenuButtonProps) {
  return (
    <IconButton
      aria-label={open ? "Close menu" : "Open menu"}
      aria-expanded={open}
      aria-controls={controlsId}
      onClick={onToggle}
      className={["nav-burger", className].filter(Boolean).join(" ")}
    >
      <MenuIcon open={open} />
    </IconButton>
  );
}
