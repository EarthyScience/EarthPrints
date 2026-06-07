type ChipProps = {
  children: React.ReactNode;
};

export function Chip({ children }: ChipProps) {
  return (
    <span className="chip">
      <span className="live" />
      {children}
    </span>
  );
}
