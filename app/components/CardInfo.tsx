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
};

/** Cor do bullet por tom (cyan-700 = ação ativa, slate-400 = futuro). */
const BULLET_CLASSES = {
  available: "text-cyan-700",
  planned: "text-slate-400",
} as const;

/**
 * @description Card de informação com título, descrição opcional e lista de bullets coloridos.
 * @param {CardInfoProps} props - Veja `CardInfoProps`.
 * @returns {JSX.Element} Elemento do card.
 */
export function CardInfo({ title, items, tone, description }: CardInfoProps) {
  return (
    <section className="border border-slate-200 rounded-lg p-4 sm:p-6 bg-white">
      <h2 className="text-lg font-semibold text-slate-900 mb-2">{title}</h2>
      {description && (
        <p className="text-sm text-slate-600 mb-3">{description}</p>
      )}
      <ul className="space-y-1 text-sm text-slate-700">
        {items.map((item) => (
          <li key={item} className="flex gap-2">
            <span
              className={cn("shrink-0 select-none", BULLET_CLASSES[tone])}
              aria-hidden="true"
            >
              •
            </span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
