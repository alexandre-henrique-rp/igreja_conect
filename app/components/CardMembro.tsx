/**
 * Componente <CardMembro /> — cards de membros visíveis em <md (S02-T03).
 *
 * Versão **mobile** da listagem. Em telas ≥ md, fica escondido (`md:hidden`)
 * — quem aparece é o `<TabelaMembros />`. Em <md, este componente é o
 * que renderiza.
 *
 * **Por que cards e não scroll horizontal na tabela?** Decisão de UX
 * (design/PRODUCT.md §5.3, DESIGN §2.2): tabelas com scroll horizontal
 * escondem colunas e frustram o usuário. Cards empilhados mostram
 * toda a informação de cada item, sem scroll lateral.
 *
 * **Estrutura de cada card (`<article>`):**
 * 1. `<h3>` com nome (link para detalhe).
 * 2. Badge de tipo + discipulador.
 * 3. Lista de ministérios (se houver).
 * 4. Botões "Editar" (se canEdit) + "Ver" (sempre).
 *
 * **Acessibilidade:**
 * - `<article>` é o container semântico (cartão de conteúdo).
 * - `<h3>` mantém hierarquia: `<h1>` da página > `<h3>` do card.
 *
 * **Tailwind 4 utility-first:** sem `@apply`. Classes via string.
 *
 * @example
 *   <CardMembro items={loaderData.items} canEdit={loaderData.canEdit} />
 *
 * @param props - Props do componente (ver `CardMembroProps`).
 * @returns Elemento JSX da lista de cards.
 */
import { Link } from "react-router";

/**
 * Reaproveita o tipo do `<TabelaMembros />` para evitar drift.
 * Items são exatamente os mesmos (subset seguro sem `senhaHash`).
 */
export type MembroListItem = {
  id: string;
  nome: string;
  tipo: "VISITANTE" | "CONGREGADO" | "MEMBRO_ATIVO";
  discipulador: { nome: string } | null;
  ministerios: { nome: string }[];
};

/**
 * Props aceitas pelo `<CardMembro>`.
 */
export type CardMembroProps = {
  items: MembroListItem[];
  canEdit: boolean;
};

/** Mesmas cores do badge da tabela (consistência visual). */
const TIPO_BADGE = {
  VISITANTE: "bg-amber-100 text-amber-800",
  CONGREGADO: "bg-blue-100 text-blue-800",
  MEMBRO_ATIVO: "bg-green-100 text-green-800",
} as const;

const TIPO_LABELS = {
  VISITANTE: "Visitante",
  CONGREGADO: "Congregado",
  MEMBRO_ATIVO: "Membro ativo",
} as const;

/**
 * @description Cards de membros (visíveis em <md); em md+ ficam escondidos.
 * @param {CardMembroProps} props - Lista de membros e flag de permissão de edição.
 * @returns {JSX.Element} Elemento da lista de cards.
 */
export function CardMembro({ items, canEdit }: CardMembroProps) {
  return (
    <div className="md:hidden space-y-3">
      {items.map((m) => (
        <article
          key={m.id}
          className="border border-slate-200 rounded-lg bg-white p-4"
        >
          <h3 className="text-base">
            <Link
              to={`/app/membros/${m.id}`}
              className="font-medium text-cyan-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-700 focus-visible:ring-offset-2 rounded"
            >
              {m.nome}
            </Link>
          </h3>
          <p className="text-sm text-slate-600 mt-1 flex items-center gap-2 flex-wrap">
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${TIPO_BADGE[m.tipo]}`}
            >
              {TIPO_LABELS[m.tipo]}
            </span>
            <span aria-hidden="true">•</span>
            <span>{m.discipulador?.nome ?? "Sem discipulador"}</span>
          </p>
          {m.ministerios.length > 0 && (
            <p className="text-sm text-slate-600 mt-2">
              <span className="text-slate-500">Ministérios:</span>{" "}
              {m.ministerios.map((mm) => mm.nome).join(", ")}
            </p>
          )}
          <div className="flex gap-2 mt-3">
            {canEdit && (
              <Link
                to={`/app/membros/${m.id}/editar`}
                className="inline-flex items-center h-9 px-3 rounded-md text-sm font-medium bg-slate-200 text-slate-900 hover:bg-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-700 focus-visible:ring-offset-2"
              >
                Editar
              </Link>
            )}
            <Link
              to={`/app/membros/${m.id}`}
              className="inline-flex items-center h-9 px-3 rounded-md text-sm font-medium text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-700 focus-visible:ring-offset-2"
            >
              Ver
            </Link>
          </div>
        </article>
      ))}
    </div>
  );
}
