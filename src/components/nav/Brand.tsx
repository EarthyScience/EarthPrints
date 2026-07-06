import Link from "next/link";
import { SITE_NAME } from "@/lib/constants/site";
import { BrandMark } from "@/icons/BrandMark";

export function Brand() {
  return (
    <Link
      href="/map"
      className="flex flex-shrink-0 items-center gap-[11px]"
      aria-label={`${SITE_NAME} home`}
    >
      <span className="flex flex-shrink-0">
        <BrandMark size={32} />
      </span>
      <span className="text-[17px] font-semibold tracking-[-0.02em] text-editor-fg-primary">
        <b className="font-semibold">{SITE_NAME}</b>
      </span>
    </Link>
  );
}
