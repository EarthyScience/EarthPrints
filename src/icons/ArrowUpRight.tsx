type ArrowUpRightProps = {
  size?: number;
};

export function ArrowUpRight({ size = 14 }: ArrowUpRightProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M7 17 17 7M8.5 7H17v8.5" />
    </svg>
  );
}
