/**
 * The EarthPrints mark: five columns of rounded bars, the middle segment of
 * each inner column carrying the accent.
 *
 * Every bar shares a width and a corner radius, so the shape holds together
 * at the 24px lockup size. The accent segments follow the theme; the outer
 * segments take whatever text colour they sit in.
 *
 * The viewBox is the artwork's own square bounding box rather than the 512
 * grid it was drawn on, so the ink fills the box it is given. Left as 512 it
 * carried 12% dead margin on every side, which pushed the mark away from the
 * wordmark and off the container's padding edge.
 */

const BAR_W = 45.9;
const BAR_RX = 22.9;

const BARS = [
  { x: 63.07, y: 43.52, h: 424.96, fill: "currentColor" },
  { x: 148.06, y: 43.52, h: 89.60, fill: "currentColor" },
  { x: 148.06, y: 143.12, h: 223.55, fill: "var(--accent)" },
  { x: 148.06, y: 376.67, h: 91.81, fill: "currentColor" },
  { x: 233.05, y: 43.52, h: 63.04, fill: "currentColor" },
  { x: 233.05, y: 116.56, h: 272.24, fill: "var(--accent)" },
  { x: 233.05, y: 398.80, h: 69.68, fill: "currentColor" },
  { x: 318.04, y: 43.52, h: 89.60, fill: "currentColor" },
  { x: 318.04, y: 143.12, h: 216.91, fill: "var(--accent)" },
  { x: 318.04, y: 370.03, h: 98.45, fill: "currentColor" },
  { x: 403.04, y: 43.52, h: 129.44, fill: "currentColor" },
  { x: 403.04, y: 182.96, h: 143.87, fill: "var(--accent)" },
  { x: 403.04, y: 336.83, h: 131.65, fill: "currentColor" },
];

type BrandMarkProps = {
  size?: number;
};

export function BrandMark({ size = 24 }: BrandMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="43.52 43.52 424.96 424.96"
      className="flex-shrink-0"
      role="img"
      aria-label="EarthPrints"
    >
      {BARS.map((bar) => (
        <rect
          key={`${bar.x}-${bar.y}`}
          x={bar.x}
          y={bar.y}
          width={BAR_W}
          height={bar.h}
          rx={BAR_RX}
          fill={bar.fill}
        />
      ))}
    </svg>
  );
}
