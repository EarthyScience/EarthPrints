"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { ArrowUpRight } from "@/icons/ArrowUpRight";
import { NAV_LINKS } from "@/lib/constants/nav";

function isActive(pathname: string, href: string): boolean {
  if (href === "#") return false;
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

type MobileMenuDropdownProps = {
  open: boolean;
  onClose: () => void;
  menuId: string;
};

export function MobileMenuDropdown({
  open,
  onClose,
  menuId,
}: MobileMenuDropdownProps) {
  const pathname = usePathname();

  useEffect(() => {
    onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  return (
    <>
      <div
        id={menuId}
        className={`nav-dropdown${open ? " open" : ""}`}
        aria-hidden={!open}
      >
        <nav className="nav-dropdown-inner" aria-label="Mobile">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className={isActive(pathname, link.href) ? "active" : undefined}
              onClick={onClose}
            >
              {link.label}
            </Link>
          ))}
          <Link href="/map" className="nav-dropdown-cta" onClick={onClose}>
            Open Map
            <span className="arrow">
              <ArrowUpRight size={14} />
            </span>
          </Link>
        </nav>
      </div>

      <button
        type="button"
        className={`nav-backdrop${open ? " open" : ""}`}
        aria-label="Close menu"
        onClick={onClose}
        tabIndex={open ? 0 : -1}
      />
    </>
  );
}
