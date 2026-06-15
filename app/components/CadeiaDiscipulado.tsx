/**
 * Componente <CadeiaDiscipulado /> — breadcrumb da cadeia (S03-T05).
 *
 * Renderiza a cadeia de discipulado (do mais alto na hierarquia
 * pastoral até o membro atual) como uma lista ordenada com setas
 * `→` entre os elos. Cada elo é um link para a página do membro.
 *
 * **Exemplo visual:** "Pr. Carlos → Disc. João → Maria"
 *
 * **Acessibilidade (WCAG 1.3.1):**
 * - `<ol>` — lista ordenada (sequência, não conjunto).
 * - Setas entre itens com `aria-hidden="true"` (decorativas — screen
 *   reader já lê "lista ordenada").
 * - Cada elo vira `<Link>` para navegação por teclado.
 *
 * **Por que setas Unicode e não SVG:** simplicidade. U+2192 renderiza
 * em qualquer fonte do sistema operacional (LGPD §2.4 — sem Google Fonts).
 *
 * @example
 *   <CadeiaDiscipulado
 *     cadeia={[
 *       { id: "a", nome: "Pr. Carlos" },
 *       { id: "b", nome: "Disc. João" },
 *       { id: "c", nome: "Maria" },
 *     ]}
 *   />
 *
 * @param props - Props do componente.
 * @returns Elemento JSX da cadeia.
 */
import { Link } from "react-router";

/**
 * Props aceitas pelo `<CadeiaDiscipulado>`.
 */
export type CadeiaDiscipuladoProps = {
  /** Lista de membros do mais alto (raiz pastoral) ao mais baixo (membro atual). */
  cadeia: { id: string; nome: string }[];
};

/**
 * @description Cadeia "A → B → C" com links para cada membro (breadcrumb hierárquico).
 * @param {CadeiaDiscipuladoProps} props - Lista de membros.
 * @returns {JSX.Element} Elemento JSX da cadeia.
 */
export function CadeiaDiscipulado({ cadeia }: CadeiaDiscipuladoProps) {
  return (
    <ol
      className="flex flex-wrap items-center gap-1 text-sm"
      data-testid="cadeia-discipulado"
    >
      {cadeia.map((m, i) => (
        <li key={m.id} className="flex items-center gap-1">
          <Link
            to={`/app/membros/${m.id}`}
            className="text-cyan-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-700 focus-visible:ring-offset-2 rounded"
          >
            {m.nome}
          </Link>
          {i < cadeia.length - 1 && (
            <span className="text-slate-400" aria-hidden="true">
              →
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}
