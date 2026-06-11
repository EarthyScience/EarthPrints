"use client";

import { Button } from "@/components/ui/Button";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { MobileMenuButton } from "@/components/nav/MobileMenuButton";

type NavActionsProps = {
  menuOpen: boolean;
  onMenuToggle: () => void;
  menuControlsId: string;
};

export function NavActions({
  menuOpen,
  onMenuToggle,
  menuControlsId,
}: NavActionsProps) {
  return (
    <div className="nav-right">
      <ThemeToggle />
      <Button href="/map" showArrow className="nav-desktop-cta">
        Open Map
      </Button>
      <div className="nav-mobile">
        <MobileMenuButton
          open={menuOpen}
          onToggle={onMenuToggle}
          controlsId={menuControlsId}
        />
      </div>
    </div>
  );
}
