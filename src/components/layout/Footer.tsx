import Link from "next/link";
import { FOOTER_TAGLINE } from "@/lib/constants/footer";
import { SITE_NAME } from "@/lib/constants/site";
import { BrandMark } from "@/icons/BrandMark";

const year = new Date().getFullYear();

export function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div className="footer-brand">
          <Link href="/map" className="footer-brand-link" aria-label={`${SITE_NAME} home`}>
            <BrandMark size={22} />
            <span>{SITE_NAME}</span>
          </Link>
          <p className="footer-tagline">{FOOTER_TAGLINE}</p>
        </div>

        <p className="footer-copy mono">
          © {year} {SITE_NAME}
        </p>
      </div>
    </footer>
  );
}
