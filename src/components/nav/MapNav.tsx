"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { BrandMark } from "@/icons/BrandMark";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { MobileMenuButton } from "@/components/nav/MobileMenuButton";
import { MapNavMenu } from "@/components/nav/MapNavMenu";
import { SITE_NAME } from "@/lib/constants/site";

export function MapNav() {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuId = useId();

  return (
    <>
      <nav className="map-nav" aria-label="Map navigation">
        <Link
          href="/"
          className="map-nav-chip map-nav-brand"
          aria-label={`${SITE_NAME} home`}
        >
          <BrandMark size={28} />
          <span className="ds-brand-word map-nav-brand-word">
            <b>{SITE_NAME}</b>
          </span>
        </Link>

        <div className="map-nav-actions">
          <ThemeToggle className="map-nav-chip map-nav-theme" />
          <MobileMenuButton
            open={menuOpen}
            onToggle={() => setMenuOpen((current) => !current)}
            controlsId={menuId}
            className="map-nav-chip map-nav-trigger"
          />
        </div>
      </nav>

      <MapNavMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        menuId={menuId}
      />
    </>
  );
}
