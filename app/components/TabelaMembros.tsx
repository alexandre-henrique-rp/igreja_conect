/**
 * Componente <TabelaMembros /> — tabela de membros visível em md+ (S02-T03).
 *
 * Renderiza uma `<table>` acessível com:
 * 1. `<caption className="sr-only">Lista de membros</caption>` — descrição
 *    para screen readers, invisível visualmente (WCAG 1.3.1).
 * 2. `<th scope="col">` em todos os cabeçalhos — associação semântica.
 * 3. Linhas com nome (link clicável) + tipo (badge colorido) + discipulador
 *    + ministérios + ações.
 * 4. **Mobile-first:** container tem `hidden md:block` — em `<md`, vira
 *    invisível e dá lugar ao `<CardMembro />` (componente irmão).
 *
 * **Acessibilidade:**
 * - `<caption>` sr-only (não polui o visual, mas informa o screen reader).
 * - Links de ação com `aria-label` descritivo (`"Ver Maria da Silva"`,
 *   `"Editar Maria da Silva"`).
 * - Contraste: badges usam tons claros (amber-100, blue-100, green-100)
 *   com texto escuro (800) — passa AA+.
 *
 * **Por que `MEMBRO_SAFE_SELECT`:** este componente consome items já
 * filtrados pelo service (loader) — a UI não tem como acessar
 * `senhaHash` ou outros PII sensíveis que não vieram no payload.
 *
 * @example
 *   <TabelaMembros
 *     items={loaderData.items}
 *     canEdit={loaderData.canEdit}
 *   />
 *
 * @param props - Props do componente (ver `TabelaMembrosProps`).
 * @returns Elemento JSX da tabela.
 */
import { Link } from "react-router";
import { cn } from "~/lib/cn";

/**
 * Item de membro para a listagem. Subset seguro (sem `senhaHash`,
 * `email` opcional) — vem do `MEMBRO_SAFE_SELECT` do service.
 */
export type MembroListItem = {
  id: string;
  nome: string;
  tipo: "VISITANTE" | "CONGREGADO" | "MEMBRO_ATIVO";
  discipulador: { nome: string } | null;
  ministerios: { nome: string }[];
};

/**
 * Props aceitas pelo `<TabelaMembros>`.
 */
export type TabelaMembrosProps = {
  /** Lista de membros a renderizar. */
  items: MembroListItem[];
  /** Se `true`, mostra o link "Editar" na coluna de ações. */
  canEdit: boolean;
};

/** Cor do badge por tipo de membro (tons claros WCAG-safe). */
const BADGE_CLASSES = {
  VISITANTE: "bg-amber-100 text-amber-800",
  CONGREGADO: "bg-blue-100 text-blue-800",
  MEMBRO_ATIVO: "bg-green-100 text-green-800",
} as const;

/** Labels em PT-BR para os tipos (UX: humano, não enum). */
const TIPO_LABELS = {
  VISITANTE: "Visitante",
  CONGREGADO: "Congregado",
  MEMBRO_ATIVO: "Membro ativo",
} as const;

/**
 * Badge de tipo de membro — usado na tabela e nos cards.
 *
 * @param props - Props do badge.
 * @param props.tipo - Tipo do membro (define cor).
 * @returns Elemento JSX do badge.
 */
function BadgeTipo({
  tipo,
}: {
  tipo: MembroListItem["tipo"];
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium",
        BADGE_CLASSES[tipo]
      )}
    >
      {TIPO_LABELS[tipo]}
    </span>
  );
}

/**
 * @description Tabela acessível de membros (md+); em mobile, escondida — usa CardMembro.
 * @param {TabelaMembrosProps} props - Lista de membros e flag de permissão de edição.
 * @returns {JSX.Element} Elemento da tabela.
 */
export function TabelaMembros({ items, canEdit }: TabelaMembrosProps) {
  return (
    <div className="hidden md:block border border-slate-200 rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <caption className="sr-only">Lista de membros</caption>
        <thead className="bg-slate-50 text-left text-xs uppercase text-slate-600 tracking-wide">
          <tr>
            <th scope="col" className="px-4 py-2 font-medium">
              Nome
            </th>
            <th scope="col" className="px-4 py-2 font-medium">
              Tipo
            </th>
            <th scope="col" className="px-4 py-2 font-medium">
              Discipulador
            </th>
            <th scope="col" className="px-4 py-2 font-medium">
              Ministérios
            </th>
            <th scope="col" className="px-4 py-2 font-medium text-right">
              Ações
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 bg-white">
          {items.map((m) => (
            <tr key={m.id} className="hover:bg-slate-50">
              <td className="px-4 py-2">
                <Link
                  to={`/app/membros/${m.id}`}
                  className="text-cyan-700 hover:underline font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-700 focus-visible:ring-offset-2 rounded"
                >
                  {m.nome}
                </Link>
              </td>
              <td className="px-4 py-2">
                <BadgeTipo tipo={m.tipo} />
              </td>
              <td className="px-4 py-2 text-slate-700">
                {m.discipulador?.nome ?? "—"}
              </td>
              <td className="px-4 py-2 text-slate-700">
                {m.ministerios.length > 0
                  ? m.ministerios.map((mm) => mm.nome).join(", ")
                  : "—"}
              </td>
              <td className="px-4 py-2 text-right whitespace-nowrap">
                <Link
                  to={`/app/membros/${m.id}`}
                  aria-label={`Ver ${m.nome}`}
                  className="inline-flex items-center justify-center h-8 w-8 rounded text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-700 focus-visible:ring-offset-2"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                </Link>
                {canEdit && (
                  <Link
                    to={`/app/membros/${m.id}/editar`}
                    aria-label={`Editar ${m.nome}`}
                    className="inline-flex items-center justify-center h-8 w-8 rounded text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-700 focus-visible:ring-offset-2 ml-1"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-4 w-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                    </svg>
                  </Link>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
