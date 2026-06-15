/**
 * Componente <ListaDiscipulos /> — lista de discípulos (S03-T05).
 *
 * Renderiza os discípulos atuais de um discipulador. Cada item tem:
 * - Nome (link para a página do discípulo).
 * - Form de "Desvincular" (POST com `intent=unassign` + `membroId`).
 *
 * **Acessibilidade:**
 * - `<ul>` semântico (lista).
 * - Form com `aria-label` no botão para clareza ("Desvincular {nome}").
 * - Quando vazia: mensagem clara em vez de container vazio.
 *
 * **RN-MEM-04:** cada "Desvincular" chama a action do backend
 * (`assignDisciple` com `intent=unassign`). O backend revalida
 * (defense in depth — 3 camadas).
 *
 * @example
 *   <ListaDiscipulos
 *     discipulos={[
 *       { id: "a", nome: "Ana" },
 *       { id: "b", nome: "Carlos" },
 *     ]}
 *   />
 *
 * @param props - Props do componente.
 * @returns Elemento JSX da lista.
 */
import { Form, Link } from "react-router";
import { Button } from "~/components/Button";

/**
 * Props aceitas pelo `<ListaDiscipulos>`.
 */
export type ListaDiscipulosProps = {
  /** Lista de discípulos (subset de Membro com id + nome). */
  discipulos: { id: string; nome: string }[];
};

/**
 * @description Lista de discípulos com link para a página de cada um e botão "Desvincular".
 * @param {ListaDiscipulosProps} props - discipulos.
 * @returns {JSX.Element} Elemento JSX da lista.
 */
export function ListaDiscipulos({ discipulos }: ListaDiscipulosProps) {
  if (discipulos.length === 0) {
    return (
      <p className="text-sm text-slate-500" data-testid="lista-vazia">
        Nenhum discípulo vinculado.
      </p>
    );
  }

  return (
    <ul
      className="divide-y divide-slate-200 border border-slate-200 rounded-lg bg-white"
      data-testid="lista-discipulos"
    >
      {discipulos.map((d) => (
        <li
          key={d.id}
          className="flex items-center justify-between px-4 py-2 gap-2"
        >
          <Link
            to={`/app/membros/${d.id}`}
            className="text-cyan-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-700 focus-visible:ring-offset-2 rounded"
          >
            {d.nome}
          </Link>
          <Form method="post" className="inline">
            <input type="hidden" name="intent" value="unassign" />
            <input type="hidden" name="membroId" value={d.id} />
            <Button
              type="submit"
              variant="ghost"
              size="sm"
              aria-label={`Desvincular ${d.nome}`}
            >
              Desvincular
            </Button>
          </Form>
        </li>
      ))}
    </ul>
  );
}
