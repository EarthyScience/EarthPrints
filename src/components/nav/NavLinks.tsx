"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_LINKS } from "@/lib/constants/nav";
import { isActiveLink } from "@/lib/nav/isActiveLink";

export function NavLinks() {
  const pathname = usePathname();

  return (
    <div className="nav-links">
      {NAV_LINKS.map((link) => (
        <Link
          key={link.label}
          href={link.href}
          className={isActiveLink(pathname, link.href) ? "active" : undefined}
        >
          {link.label}
        </Link>
      ))}
    </div>
  );
}
