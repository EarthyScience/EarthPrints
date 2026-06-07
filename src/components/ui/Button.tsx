import Link from "next/link";
import { ArrowUpRight } from "@/icons/ArrowUpRight";

type ButtonProps = {
  href: string;
  children: React.ReactNode;
  variant?: "primary" | "outline";
  size?: "default" | "lg";
  showArrow?: boolean;
  arrowSize?: number;
  className?: string;
};

export function Button({
  href,
  children,
  variant = "primary",
  size = "default",
  showArrow = false,
  arrowSize,
  className,
}: ButtonProps) {
  const classes = [
    variant === "primary" ? "btn-primary" : "btn-outline",
    size === "lg" ? "lg" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <Link href={href} className={classes}>
      {children}
      {showArrow && (
        <span className="arrow">
          <ArrowUpRight size={arrowSize ?? (size === "lg" ? 15 : 14)} />
        </span>
      )}
    </Link>
  );
}
