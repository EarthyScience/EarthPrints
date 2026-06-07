import Link from "next/link";
import { FOOTER_LINKS, FOOTER_TAGLINE } from "@/lib/constants/footer";
import { SITE_NAME } from "@/lib/constants/site";
import { BrandMark } from "@/icons/BrandMark";

const year = new Date().getFullYear();

export function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div className="footer-brand">
          <Link href="/" className="footer-brand-link" aria-label={`${SITE_NAME} home`}>
            <BrandMark size={22} />
            <span>{SITE_NAME}</span>
          </Link>
          <p className="footer-tagline">{FOOTER_TAGLINE}</p>
        </div>

        <div className="footer-right">
          <nav className="footer-nav" aria-label="Footer">
            {FOOTER_LINKS.map((link) => (
              <Link key={link.href} href={link.href}>
                {link.label}
              </Link>
            ))}
          </nav>

          <p className="footer-copy mono">
            © {year} {SITE_NAME}
          </p>
        </div>
      </div>
    </footer>
  );
}
