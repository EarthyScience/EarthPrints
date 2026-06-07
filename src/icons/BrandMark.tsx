import Image from "next/image";

type BrandMarkProps = {
  size?: number;
};

export function BrandMark({ size = 24 }: BrandMarkProps) {
  return (
    <>
      <Image
        src="/brand-mark-dark.png"
        alt=""
        width={size}
        height={size}
        className="brand-mark brand-mark--dark"
        priority
      />
      <Image
        src="/brand-mark-light.png"
        alt=""
        width={size}
        height={size}
        className="brand-mark brand-mark--light"
        priority
      />
    </>
  );
}
