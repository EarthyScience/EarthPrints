type IconButtonProps = {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  "aria-label": string;
  "aria-expanded"?: boolean;
  "aria-controls"?: string;
  /** When set, renders an anchor to this URL instead of a button. */
  href?: string;
};

// Every IconButton renders inside the editor nav, so the editor sizing/colour
// treatment is the base style here.
const ICON_BUTTON_CLASS =
  "grid size-8 place-items-center rounded-editor-sm border border-editor-border " +
  "bg-editor-bg-primary text-editor-fg-secondary transition-all duration-200 " +
  "hover:border-editor-border hover:bg-editor-bg-primary hover:text-editor-fg-primary hover:shadow-editor";

export function IconButton({
  children,
  onClick,
  className,
  "aria-label": ariaLabel,
  "aria-expanded": ariaExpanded,
  "aria-controls": ariaControls,
  href,
}: IconButtonProps) {
  const classes = [ICON_BUTTON_CLASS, className].filter(Boolean).join(" ");

  if (href) {
    return (
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
    );
  }

  return (
    <button
      type="button"
      className={classes}
      onClick={onClick}
      aria-label={ariaLabel}
      aria-expanded={ariaExpanded}
      aria-controls={ariaControls}
    >
      {children}
    </button>
  );
}
