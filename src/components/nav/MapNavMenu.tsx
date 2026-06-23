"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { NAV_LINKS } from "@/lib/constants/nav";
import { isActiveLink } from "@/lib/nav/isActiveLink";

type MapNavMenuProps = {
  open: boolean;
  onClose: () => void;
  menuId: string;
};

export function MapNavMenu({ open, onClose, menuId }: MapNavMenuProps) {
  const pathname = usePathname();

  useEffect(() => {
    onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  if (!open) return null;

  return (
    <aside
      id={menuId}
      className="map-nav-menu map-panel map-panel--right map-island ds-enter"
      aria-label="Site menu"
    >
      <nav className="map-nav-menu-links" aria-label="Main">
        {NAV_LINKS.map((link) => (
          <Link
            key={link.label}
            href={link.href}
            className={isActiveLink(pathname, link.href) ? "active" : undefined}
            onClick={onClose}
          >
            {link.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
