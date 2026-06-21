type BrandMarkProps = {
  size?: number;
};

export function BrandMark({ size = 24 }: BrandMarkProps) {
  return (
    <span
      className="brand-mark"
      style={{ width: size, height: size }}
      aria-hidden="true"
    />
  );
}
