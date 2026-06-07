type IconButtonProps = {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  "aria-label": string;
  "aria-expanded"?: boolean;
  "aria-controls"?: string;
};

export function IconButton({
  children,
  onClick,
  className,
  "aria-label": ariaLabel,
  "aria-expanded": ariaExpanded,
  "aria-controls": ariaControls,
}: IconButtonProps) {
  return (
    <button
      type="button"
      className={["icon-btn", className].filter(Boolean).join(" ")}
      onClick={onClick}
      aria-label={ariaLabel}
      aria-expanded={ariaExpanded}
      aria-controls={ariaControls}
    >
      {children}
    </button>
  );
}
