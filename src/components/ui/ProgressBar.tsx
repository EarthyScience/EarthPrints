type ProgressBarProps = {
  /**
   * Completion fraction in [0, 1]. Omit for an indeterminate bar that
   * animates while work is in flight without claiming a percentage.
   */
  value?: number;
  label?: string;
  className?: string;
};

export function ProgressBar({
  value,
  label = "Loading",
  className,
}: ProgressBarProps) {
  const indeterminate = value === undefined;
  const pct = indeterminate ? 0 : Math.round(Math.min(1, Math.max(0, value)) * 100);

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={indeterminate ? undefined : pct}
      aria-busy={indeterminate || pct < 100}
      className={`relative h-1 w-full overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--editor-fg-tertiary)_22%,transparent)] ${className ?? ""}`}
    >
      {indeterminate ? (
        <span className="progress-bar-indeterminate absolute inset-y-0 left-0 w-2/5 rounded-full bg-accent" />
      ) : (
        <span
          className="absolute inset-y-0 left-0 rounded-full bg-accent transition-[width] duration-300 ease-out"
          style={{ width: `${pct}%` }}
        />
      )}
    </div>
  );
}
