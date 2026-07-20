/**
 * Componente <Button /> — botão reutilizável do Igreja Conect (S01-T06).
 *
 * **Variantes visuais:** `primary` (cyan-700, CTA padrão), `secondary`
 * (fundo claro, ações neutras), `ghost` (transparente, ação terciária)
 * e `danger` (vermelho, ações destrutivas como "Excluir").
 *
 * **Tamanhos:** `sm` (h-9) e `md` (h-11). Default = `md`.
 *
 * **Polimorfismo:** aceita `as` + `to` para virar `<Link to={to}>`
 * (do react-router) — útil no CTA da landing que navega para `/login`.
 * Sem `as`, renderiza `<button>` HTML padrão.
 *
 * **Loading:** quando `loading=true`, mostra um `<Spinner />` inline,
 * marca `aria-busy="true"` e desabilita cliques. Use durante submits
 * que dependem de `useNavigation().state === "submitting"`.
 *
 * **Acessibilidade (WCAG 2.1 AA):**
 * - `focus-visible:ring-2 focus-visible:ring-cyan-700` garante foco visível.
 * - `aria-busy` durante loading informa ao screen reader.
 * - Contraste cyan-700/branco = ~5.5:1 (passa AA+).
 *
 * **Tailwind 4 utility-first:** sem `@apply`. As classes vêm de
 * tokens definidos em `app/app.css` → `@theme`.
 *
 * @example
 *   // Botão primário padrão
 *   <Button variant="primary" type="submit">Entrar</Button>
 *
 * @example
 *   // CTA da landing que navega para /login
 *   <Button as={Link} to="/login" variant="primary">
 *     Entrar no sistema →
 *   </Button>
 *
 * @example
 *   // Submit com loading durante submitting
 *   const nav = useNavigation();
 *   <Button type="submit" loading={nav.state === "submitting"}>
 *     Entrar
 *   </Button>
 *
 * @param props - Props do componente (ver `ButtonProps`).
 * @returns Elemento JSX do botão.
 */
import type { ElementType, MouseEventHandler, ReactNode } from "react";
import { cn } from "~/lib/cn";

/**
 * Props aceitas pelo `<Button>`. `as` + `to` permitem virar `<Link>`
 * sem precisar de componente separado.
 */
export type ButtonProps = {
  /** Variante visual. Default: `primary`. */
  variant?: "primary" | "secondary" | "ghost" | "danger" | "blue";
  /** Tamanho. Default: `md`. */
  size?: "sm" | "md";
  /** Faz o botão ocupar 100% da largura do container. */
  fullWidth?: boolean;
  /** Componente a renderizar no lugar do `<button>` (ex: `Link`). */
  as?: ElementType;
  /** URL para `<Link to>`. Ignorado se `as` não for `Link`. */
  to?: string;
  /** `type` HTML do `<button>`. Default: `button`. */
  type?: "button" | "submit" | "reset";
  /** Desabilita o botão (sem clique, sem submit). */
  disabled?: boolean;
  /** Mostra spinner e bloqueia interação. Default: `false`. */
  loading?: boolean;
  /** Handler de clique (passado para `<button onClick>`). */
  onClick?: MouseEventHandler<HTMLElement>;
  /** Conteúdo do botão. */
  children: ReactNode;
  /** Classes extras. */
  className?: string;
  /** `aria-label` para screen readers quando o conteúdo visual é ambíguo. */
  "aria-label"?: string;
  /** ID do formulário HTML que este botão submete (HTML `form` attribute). */
  form?: string;
};

/** Mapa de classes por variante (mantém o JSX limpo). */
const VARIANT_CLASSES = {
  primary:
    "bg-cyan-700 text-white hover:bg-cyan-800 active:bg-cyan-900 border border-transparent",
  secondary:
    "bg-slate-200 text-slate-900 hover:bg-slate-300 border border-transparent",
  ghost: "bg-transparent text-slate-700 hover:bg-slate-100 border border-transparent",
  danger: "bg-red-700 text-white hover:bg-red-800 border border-transparent",
  blue: "bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 border border-transparent shadow-lg shadow-blue-500/20",
} as const;

/** Mapa de classes por tamanho. */
const SIZE_CLASSES = {
  sm: "h-9 px-3 text-sm",
  md: "h-11 px-4 text-base",
} as const;

/** Spinner inline (SVG, sem deps externas). Renderiza só quando loading. */
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

/**
 * @description Botão reutilizável com 4 variantes, 2 tamanhos, suporte a
 *   polimorfismo (`as={Link}`) e estado de loading.
 * @param {ButtonProps} props - Variante, tamanho, conteúdo, etc.
 * @returns {JSX.Element} Elemento do botão.
 */
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
    // Base sempre presente
    "inline-flex items-center justify-center gap-2 rounded-md font-medium",
    "transition-colors select-none",
    "focus-visible:outline-none focus-visible:ring-2",
    variant === "blue"
      ? "focus-visible:ring-blue-500 focus-visible:ring-offset-0"
      : "focus-visible:ring-cyan-700 focus-visible:ring-offset-2",
    "disabled:opacity-50 disabled:cursor-not-allowed",
    fullWidth && "w-full",
    // Variante + tamanho
    VARIANT_CLASSES[variant],
    SIZE_CLASSES[size],
    className
  );

  // Quando vira <Link>, `to` é obrigatório; quando é <button>, `type`.
  // Não validamos em runtime — TypeScript pega em build.
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
