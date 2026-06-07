"use client";

import { useId, useState } from "react";
import { Brand } from "@/components/nav/Brand";
import { MobileMenuButton } from "@/components/nav/MobileMenuButton";
import { MobileMenuDropdown } from "@/components/nav/MobileMenuDropdown";
import { NavActions } from "@/components/nav/NavActions";
import { NavLinks } from "@/components/nav/NavLinks";

export function Nav() {
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
