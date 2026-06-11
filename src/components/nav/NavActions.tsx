"use client";

import { usePathname } from "next/navigation";
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
  const pathname = usePathname();
  const onMapPage = pathname === "/map" || pathname.startsWith("/map/");

  return (
    <div className="nav-right">
      <ThemeToggle />
      {!onMapPage && (
        <Button href="/map" showArrow className="nav-desktop-cta">
          Open Map
        </Button>
      )}
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
