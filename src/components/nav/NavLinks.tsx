"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_LINKS } from "@/lib/constants/nav";

function isActive(pathname: string, href: string): boolean {
  if (href === "#") return false;
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function NavLinks() {
  const pathname = usePathname();

  return (
    <div className="nav-links">
      {NAV_LINKS.map((link) => (
        <Link
          key={link.label}
          href={link.href}
          className={isActive(pathname, link.href) ? "active" : undefined}
        >
          {link.label}
        </Link>
      ))}
    </div>
  );
}
