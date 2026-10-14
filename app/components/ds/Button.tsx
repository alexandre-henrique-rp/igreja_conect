/**
 * <Button /> — primitivo do Design System Igreja Conect.
 *
 * **Variantes:** `primary` (ação padrão), `secondary` (ação neutra),
 * `ghost` (ação terciária), `danger` (destrutiva), `link` (inline).
 *
 * **Tamanhos:** `sm` (h-9), `md` (h-11), `lg` (h-12).
 *
 * **Polimorfismo:** `as` + `to` permitem virar `<Link>` sem componente
 * separado. Quando vira link, `to` é obrigatório.
 *
 * **Loading:** mostra spinner, marca `aria-busy`, desabilita cliques.
 *
 * **Tokens:** usa classes semânticas (`bg-accent`, `text-fg`, `border-border-strong`).
 * Aceita `className` extra para ajustes pontuais no endpoint.
 *
 * @example
 *   <Button variant="primary" size="md" type="submit">Salvar</Button>
 *
 * @example
 *   <Button as={Link} to="/app/membros" variant="secondary">Cancelar</Button>
 *
 * @example
 *   <Button loading={navigation.state === "submitting"}>Entrar</Button>
 */
import type { ElementType, MouseEventHandler, ReactNode } from "react";
import { cn } from "~/lib/cn";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "danger"
  | "link";

export type ButtonSize = "sm" | "md" | "lg";

export type ButtonProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  as?: ElementType;
  to?: string;
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
  loading?: boolean;
  onClick?: MouseEventHandler<HTMLElement>;
  children: ReactNode;
  className?: string;
  "aria-label"?: string;
  form?: string;
};

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    "bg-accent text-white hover:bg-accent-strong active:bg-accent-strong border border-transparent shadow-sm",
  secondary:
    "bg-surface text-fg hover:bg-surface-2 border border-border-strong",
  ghost:
    "bg-transparent text-muted hover:bg-surface-3 hover:text-fg border border-transparent",
  danger: "bg-danger text-white hover:opacity-90 border border-transparent",
  link:
    "bg-transparent text-accent hover:text-accent-strong underline-offset-4 hover:underline border border-transparent px-0 h-auto",
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: "h-9 px-3 text-sm",
  md: "h-11 px-4 text-base",
  lg: "h-12 px-5 text-base",
};

function Spinner() {
  return (
    <svg
      className="h-4 w-4 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      data-testid="spinner"
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeOpacity="0.25"
        strokeWidth="4"
      />
      <path
        d="M22 12a10 10 0 0 1-10 10"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Button({
  variant = "primary",
  size = "md",
  fullWidth = false,
  as,
  to,
  type = "button",
  disabled = false,
  loading = false,
  onClick,
  children,
  className,
  form,
  ...rest
}: ButtonProps) {
  const Component = (as ?? "button") as ElementType;

  const classes = cn(
    "inline-flex items-center justify-center gap-2 rounded-md font-medium",
    "transition-colors select-none",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
    "disabled:opacity-50 disabled:cursor-not-allowed",
    fullWidth && "w-full",
    VARIANT_CLASSES[variant],
    SIZE_CLASSES[size],
    className,
  );

  const extraProps =
    Component === "button"
      ? { type, disabled: disabled || loading, onClick, form }
      : { to, onClick };

  return (
    <Component
      className={classes}
      aria-busy={loading || undefined}
      aria-disabled={disabled || loading || undefined}
      {...extraProps}
      {...rest}
    >
      {loading && <Spinner />}
      <span className={cn(loading && "opacity-80")}>{children}</span>
    </Component>
  );
}
