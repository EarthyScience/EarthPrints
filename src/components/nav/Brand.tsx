import Image from "next/image";
import Link from "next/link";
import { SITE_NAME } from "@/lib/constants/site";

export function Brand() {
  return (
    <Link
      href="/map"
      className="flex min-w-0 items-center gap-1"
      aria-label={`${SITE_NAME} home`}
    >
      <span className="flex flex-shrink-0 text-editor-fg-primary">
        <Image
          src="/earthprints-bars.svg?v=7"
          width={24}
          height={24}
          className="hidden [.light_&]:block"
          alt=""
          aria-hidden="true"
        />
        <Image
          src="/earthprints-bars-dark.svg?v=7"
          width={24}
          height={24}
          className="block [.light_&]:hidden"
          alt=""
          aria-hidden="true"
        />
      </span>
      <span className="truncate text-[17px] font-semibold tracking-[-0.02em] text-editor-fg-primary">
        <b className="font-semibold">{SITE_NAME}</b>
      </span>
    </Link>
  );
}
