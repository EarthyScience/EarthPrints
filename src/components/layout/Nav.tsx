"use client";

import { usePathname } from "next/navigation";
import { useId, useState } from "react";
import { Brand } from "@/components/nav/Brand";
import { MapNav } from "@/components/nav/MapNav";
import { MobileMenuDropdown } from "@/components/nav/MobileMenuDropdown";
import { NavActions } from "@/components/nav/NavActions";
import { NavLinks } from "@/components/nav/NavLinks";

function MarketingNav() {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuId = useId();

  return (
    <nav className="nav">
      <div className="nav-inner">
        <Brand />
        <NavLinks />
        <NavActions
          menuOpen={menuOpen}
          onMenuToggle={() => setMenuOpen((current) => !current)}
          menuControlsId={menuId}
        />
      </div>
      <MobileMenuDropdown
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        menuId={menuId}
      />
    </nav>
  );
}

export function Nav() {
  const pathname = usePathname();
  const onMapPage = pathname === "/map" || pathname.startsWith("/map/");

  if (onMapPage) {
    return <MapNav />;
  }

  return <MarketingNav />;
}
