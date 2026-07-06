type IconButtonProps = {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  "aria-label": string;
  "aria-expanded"?: boolean;
  "aria-controls"?: string;
  "aria-pressed"?: boolean;
};

// Every IconButton renders inside the editor nav, so the editor sizing/colour
// treatment is the base style here.
const ICON_BUTTON_CLASS =
  "grid size-8 place-items-center rounded-editor-sm border border-editor-border " +
  "bg-editor-bg-primary text-editor-fg-secondary transition-all duration-200 " +
  "hover:border-editor-border hover:bg-editor-bg-primary hover:text-editor-fg-primary hover:shadow-editor";

// Toggle buttons highlight with the accent when pressed.
const ICON_BUTTON_PRESSED_CLASS =
  "border-[color-mix(in_srgb,var(--accent)_45%,transparent)] " +
  "bg-[color-mix(in_srgb,var(--accent)_16%,transparent)] text-accent " +
  "hover:text-accent hover:border-[color-mix(in_srgb,var(--accent)_45%,transparent)] " +
  "hover:bg-[color-mix(in_srgb,var(--accent)_16%,transparent)]";

export function IconButton({
  children,
  onClick,
  className,
  "aria-label": ariaLabel,
  "aria-expanded": ariaExpanded,
  "aria-controls": ariaControls,
  "aria-pressed": ariaPressed,
}: IconButtonProps) {
  return (
    <button
      type="button"
      className={[
        ICON_BUTTON_CLASS,
        ariaPressed ? ICON_BUTTON_PRESSED_CLASS : null,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      onClick={onClick}
      aria-label={ariaLabel}
      aria-expanded={ariaExpanded}
      aria-controls={ariaControls}
      aria-pressed={ariaPressed}
    >
      {children}
    </button>
  );
}
