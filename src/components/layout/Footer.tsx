import Image from "next/image";
import Link from "next/link";
import { FOOTER_TAGLINE } from "@/lib/constants/footer";
import { SITE_NAME } from "@/lib/constants/site";

const year = new Date().getFullYear();

export function Footer() {
  return (
    <footer className="site-footer border-t border-border bg-[color-mix(in_srgb,var(--surface)_35%,transparent)] px-[clamp(22px,6vw,84px)] pb-[34px] pt-7 max-[720px]:px-[22px] max-[720px]:pb-7 max-[720px]:pt-6">
      <div className="mx-auto flex max-w-[1200px] flex-wrap items-start justify-between gap-6 max-[720px]:flex-col max-[720px]:items-stretch max-[720px]:gap-0">
        <div className="max-w-[360px] flex-[1_1_220px] max-[720px]:max-w-none max-[720px]:flex-none max-[720px]:pb-5">
          <Link
            href="/map"
            className="mb-2 inline-flex items-center gap-1 text-base font-semibold tracking-[-0.02em] transition-opacity duration-200 hover:opacity-80"
            aria-label={`${SITE_NAME} home`}
          >
            <span className="flex flex-shrink-0">
              <Image
                src="/earthprints-bars.svg?v=6"
                width={24}
                height={24}
                className="hidden [.light_&]:block"
                alt=""
                aria-hidden="true"
              />
              <Image
                src="/earthprints-bars-dark.svg?v=6"
                width={24}
                height={24}
                className="block [.light_&]:hidden"
                alt=""
                aria-hidden="true"
              />
            </span>
            <span>{SITE_NAME}</span>
          </Link>
          <p className="text-sm leading-[1.55] tracking-[-0.01em] text-text-muted">
            {FOOTER_TAGLINE}
          </p>
        </div>

        <p className="text-right font-mono text-[11px] uppercase tracking-[0.04em] text-text-dim max-[720px]:pt-1 max-[720px]:text-left">
          © {year} {SITE_NAME}
        </p>
      </div>
    </footer>
  );
}
