import Link from "next/link";
import { SITE_NAME } from "@/lib/constants/site";
import { BrandMark } from "@/icons/BrandMark";

export function Brand() {
  return (
    <Link href="/" className="brand" aria-label={`${SITE_NAME} home`}>
      <span className="mark">
        <BrandMark size={32} />
      </span>
      <span className="word">
        <b>{SITE_NAME}</b>
      </span>
    </Link>
  );
}
