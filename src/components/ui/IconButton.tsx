type IconButtonProps = {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  "aria-label": string;
  /** Visible hover/focus label. Falls back to aria-label when omitted. */
  tooltip?: string;
  "aria-expanded"?: boolean;
  "aria-controls"?: string;
  "aria-pressed"?: boolean;
};

// Every IconButton renders inside the editor nav, so the editor sizing/colour
// treatment is the base style here.
const ICON_BUTTON_CLASS =
  "peer grid size-8 place-items-center rounded-editor-sm border border-editor-border " +
  "bg-editor-bg-primary text-editor-fg-secondary transition-all duration-200 " +
  "hover:border-editor-border hover:bg-editor-bg-primary hover:text-editor-fg-primary hover:shadow-editor";

// Toggle buttons highlight with the accent when pressed.
const ICON_BUTTON_PRESSED_CLASS =
  "border-[color-mix(in_srgb,var(--accent)_45%,transparent)] " +
  "bg-[color-mix(in_srgb,var(--accent)_16%,transparent)] text-accent " +
  "hover:text-accent hover:border-[color-mix(in_srgb,var(--accent)_45%,transparent)] " +
  "hover:bg-[color-mix(in_srgb,var(--accent)_16%,transparent)]";

// Appears below the button on hover or keyboard focus. Decorative only — the
// button keeps its aria-label so screen readers do not double-announce.
const TOOLTIP_CLASS =
  "pointer-events-none absolute left-1/2 top-full z-[200] mt-2 -translate-x-1/2 " +
  "translate-y-[-2px] whitespace-nowrap rounded-editor-sm border border-editor-border " +
  "bg-editor-bg-depth px-2 py-1 text-xs font-medium text-editor-fg-primary shadow-editor " +
  "opacity-0 transition-all duration-150 " +
  "group-hover:translate-y-0 group-hover:opacity-100 " +
  "group-focus-within:translate-y-0 group-focus-within:opacity-100 " +
  "peer-aria-expanded:hidden";

export function IconButton({
  children,
  onClick,
  className,
  "aria-label": ariaLabel,
  tooltip,
  "aria-expanded": ariaExpanded,
  "aria-controls": ariaControls,
  "aria-pressed": ariaPressed,
}: IconButtonProps) {
  const tooltipLabel = tooltip ?? ariaLabel;

  return (
    <span className="group relative inline-flex">
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
      <span role="tooltip" aria-hidden="true" className={TOOLTIP_CLASS}>
        {tooltipLabel}
      </span>
    </span>
  );
}
