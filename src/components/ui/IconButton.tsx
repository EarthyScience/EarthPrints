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
  /** When set, renders an anchor to this URL instead of a button. */
  href?: string;
  /**
   * "plain" drops the border/background so the button reads as a bare icon —
   * used inside the mobile floating islands, which already carry their own
   * border and shadow.
   */
  variant?: "default" | "plain";
  tooltipPlacement?: "bottom" | "left";
  /** Anchor for the guided tour, so it can light the control and not a wrapper. */
  "data-tour"?: string;
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

// Borderless variant — no border or resting background.
const ICON_BUTTON_PLAIN_CLASS =
  "peer grid size-8 place-items-center rounded-editor-sm border border-transparent " +
  "bg-transparent text-editor-fg-secondary transition-all duration-200 " +
  "hover:bg-editor-bg-secondary hover:text-editor-fg-primary";

const ICON_BUTTON_PLAIN_PRESSED_CLASS =
  "bg-[color-mix(in_srgb,var(--accent)_16%,transparent)] text-accent " +
  "hover:text-accent hover:bg-[color-mix(in_srgb,var(--accent)_16%,transparent)]";

// Appears on hover or keyboard focus. Decorative only — the button keeps its
// aria-label so screen readers do not double-announce.
const TOOLTIP_CLASS =
  "pointer-events-none absolute z-[200] whitespace-nowrap rounded-editor-sm " +
  "border border-editor-border bg-editor-bg-depth px-2 py-1 text-xs font-medium " +
  "text-editor-fg-primary shadow-editor opacity-0 transition-all duration-150 " +
  "group-hover:opacity-100 group-focus-within:opacity-100 peer-aria-expanded:hidden";

const TOOLTIP_BOTTOM_CLASS =
  "left-1/2 top-full mt-2 -translate-x-1/2 translate-y-[-2px] " +
  "group-hover:translate-y-0 group-focus-within:translate-y-0";

const TOOLTIP_LEFT_CLASS =
  "right-full top-1/2 mr-2 -translate-y-1/2 translate-x-[2px] " +
  "group-hover:translate-x-0 group-focus-within:translate-x-0";

export function IconButton({
  children,
  onClick,
  className,
  "aria-label": ariaLabel,
  tooltip,
  "aria-expanded": ariaExpanded,
  "aria-controls": ariaControls,
  "aria-pressed": ariaPressed,
  "data-tour": dataTour,
  href,
  variant = "default",
  tooltipPlacement = "bottom",
}: IconButtonProps) {
  const tooltipLabel = tooltip ?? ariaLabel;
  const plain = variant === "plain";
  const classes = [
    plain ? ICON_BUTTON_PLAIN_CLASS : ICON_BUTTON_CLASS,
    ariaPressed
      ? plain
        ? ICON_BUTTON_PLAIN_PRESSED_CLASS
        : ICON_BUTTON_PRESSED_CLASS
      : null,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const control = href ? (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className={classes}
      aria-label={ariaLabel}
      onClick={onClick}
    >
      {children}
    </a>
  ) : (
    <button
      type="button"
      className={classes}
      onClick={onClick}
      aria-label={ariaLabel}
      aria-expanded={ariaExpanded}
      aria-controls={ariaControls}
      aria-pressed={ariaPressed}
      data-tour={dataTour}
    >
      {children}
    </button>
  );

  return (
    <span className="group relative inline-flex">
      {control}
      <span
        role="tooltip"
        aria-hidden="true"
        className={`${TOOLTIP_CLASS} ${
          tooltipPlacement === "left"
            ? TOOLTIP_LEFT_CLASS
            : TOOLTIP_BOTTOM_CLASS
        }`}
      >
        {tooltipLabel}
      </span>
    </span>
  );
}
