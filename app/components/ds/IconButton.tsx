/**
 * <IconButton /> — botão quadrado só com ícone.
 *
 * @example
 *   <IconButton aria-label="Fechar" onClick={...}>
 *     <IconX />
 *   </IconButton>
 */
import type { ElementType, MouseEventHandler, ReactNode } from "react";
import { cn } from "~/lib/cn";

export type IconButtonProps = {
  size?: "sm" | "md";
  variant?: "ghost" | "secondary" | "danger";
  as?: ElementType;
  to?: string;
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
  onClick?: MouseEventHandler<HTMLElement>;
  "aria-label": string;
  children: ReactNode;
  className?: string;
};

const VARIANT_CLASSES = {
  ghost: "bg-transparent text-muted hover:bg-surface-3 hover:text-fg",
  secondary:
    "bg-surface text-fg hover:bg-surface-2 border border-border-strong",
  danger: "bg-danger-soft text-danger hover:opacity-90",
} as const;

const SIZE_CLASSES = {
  sm: "h-9 w-9",
  md: "h-11 w-11",
} as const;

export function IconButton({
  size = "md",
  variant = "ghost",
  as,
  to,
  type = "button",
  disabled,
  onClick,
  children,
  className,
  ...rest
}: IconButtonProps) {
  const Component = (as ?? "button") as ElementType;
  const classes = cn(
    "inline-flex items-center justify-center rounded-md",
    "transition-colors select-none",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
    "disabled:opacity-50 disabled:cursor-not-allowed",
    VARIANT_CLASSES[variant],
    SIZE_CLASSES[size],
    className,
  );

  const extraProps =
    Component === "button" ? { type, disabled, onClick } : { to, onClick };

  return (
    <Component className={classes} {...extraProps} {...rest}>
      {children}
    </Component>
  );
}
