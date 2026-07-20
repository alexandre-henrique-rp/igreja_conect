/**
 * Componente <CardInfo /> — card de informação com lista de bullets (S01-T09).
 *
 * Renderiza um `<section>` com título, descrição opcional, e lista de
 * itens com bullet colorido conforme o `tone` (cyan-700 = disponível,
 * slate-400 = planejado).
 *
 * **Uso típico:** na landing pública, para mostrar "O que está
 * disponível agora" e "Em desenvolvimento" sem precisar de Markdown.
 *
 * **Visual:**
 * - Container com `border` + `rounded-lg` + `bg-white` (card clean).
 * - `<h2>` slate-900 (hierarquia após o `<h1>` da página).
 * - Bullets via caractere `•` colorido (mais simples que SVG/Unicode extra).
 *
 * **Acessibilidade:**
 * - `<section>` sem `aria-labelledby` aqui — quem usa o componente
 *   pode envolver em container maior com `<h1>` da página acima.
 * - Lista semântica `<ul>/<li>` (não `<div>` com bullets falsos).
 *
 * @example
 *   <CardInfo
 *     title="O que está disponível agora"
 *     tone="available"
 *     items={["Membros", "Discipulado", "Alertas"]}
 *     description="Funcionalidades ativas no MVP."
 *   />
 *
 * @example
 *   <CardInfo
 *     title="Em desenvolvimento"
 *     tone="planned"
 *     items={["Financeiro", "Estoque", "Manutenção"]}
 *   />
 *
 * @param props - Props do componente (ver `CardInfoProps`).
 * @returns Elemento JSX do card.
 */
import { cn } from "~/lib/cn";

/**
 * Props aceitas pelo `<CardInfo>`.
 */
export type CardInfoProps = {
  /** Título do card (renderizado como `<h2>`). */
  title: string;
  /** Itens listados como bullets dentro do card. */
  items: string[];
  /** Tom visual — define a cor do bullet de cada item. */
  tone: "available" | "planned";
  /** Descrição opcional exibida entre o título e a lista. */
  description?: string;
  /** Variante visual — dark usa fundo escuro (landing). */
  variant?: "light" | "dark";
};

const BULLET_CLASSES = {
  available: { light: "text-cyan-700", dark: "text-blue-400" },
  planned: { light: "text-slate-400", dark: "text-slate-500" },
} as const;

/**
 * @description Card de informação com título, descrição opcional e lista de bullets coloridos.
 * @param {CardInfoProps} props - Veja `CardInfoProps`.
 * @returns {JSX.Element} Elemento do card.
 */
export function CardInfo({ title, items, tone, description, variant = "light" }: CardInfoProps) {
  const isDark = variant === "dark";

  return (
    <section
      className={cn(
        "rounded-xl p-5 sm:p-6",
        isDark
          ? "bg-[#121b2c]/70 backdrop-blur-sm border border-[#202f47]"
          : "border border-slate-200 bg-white"
      )}
    >
      <h2
        className={cn(
          "text-lg font-semibold mb-2",
          isDark ? "text-white" : "text-slate-900"
        )}
      >
        {title}
      </h2>
      {description && (
        <p
          className={cn(
            "text-sm mb-3",
            isDark ? "text-slate-400" : "text-slate-600"
          )}
        >
          {description}
        </p>
      )}
      <ul className={cn("space-y-1.5 text-sm", isDark ? "text-slate-300" : "text-slate-700")}>
        {items.map((item) => (
          <li key={item} className="flex items-start gap-2.5">
            <span
              className={cn("shrink-0 select-none mt-0.5", BULLET_CLASSES[tone][variant])}
              aria-hidden="true"
            >
              {isDark ? "✦" : "•"}
            </span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
