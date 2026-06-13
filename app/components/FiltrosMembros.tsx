/**
 * Componente <FiltrosMembros /> — filtros de listagem (URL state) (S02-T03).
 *
 * Form com `method="get"` apontando para a própria rota. Os campos
 * viram search params na URL — assim:
 * 1. Refresh preserva filtros.
 * 2. Back/forward do browser funciona.
 * 3. Link compartilhável ("olha essa busca: /app/membros?tipo=VISITANTE&q=maria").
 *
 * **Campos:**
 * - `q` (text): busca textual por nome.
 * - `tipo` (select): VISITANTE | CONGREGADO | MEMBRO_ATIVO | (vazio).
 * - `ministerioId` (select): ministérios cadastrados | (vazio).
 * - `discipuladorId` (select): discípulos potenciais (membros com cargo) | (vazio).
 *
 * **Layout responsivo (mobile-first):**
 * - `<sm`: 1 coluna (empilhado).
 * - `sm`: 2 colunas.
 * - `lg`: 4 colunas + bloco de botões à direita.
 *
 * **Botão "Limpar":** link para `/app/membros` (sem query string),
 * reseta todos os filtros com 1 clique.
 *
 * **Acessibilidade:**
 * - `<label>` em cada campo com `htmlFor` (via `<Input>` e `<Select>`).
 * - `<form method="get">` submete com Enter em qualquer campo (UX padrão).
 *
 * @example
 *   <FiltrosMembros
 *     defaultValues={{
 *       q: params.get("q") ?? undefined,
 *       tipo: params.get("tipo") ?? undefined,
 *       ministerioId: params.get("ministerioId") ?? undefined,
 *       discipuladorId: params.get("discipuladorId") ?? undefined,
 *     }}
 *     ministerios={loaderData.ministerios}
 *     discipuladores={loaderData.discipuladores}
 *   />
 *
 * @param props - Props do componente (ver `FiltrosMembrosProps`).
 * @returns Elemento JSX do form de filtros.
 */
import { Form, Link } from "react-router";
import { Button } from "./Button";
import { Input } from "./Input";
import { Select } from "./Select";

/**
 * Default values dos filtros (vindos da URL no loader).
 */
export type FiltrosMembrosDefaultValues = {
  /** Texto de busca. */
  q?: string;
  /** Tipo selecionado. */
  tipo?: string;
  /** ID do ministério selecionado. */
  ministerioId?: string;
  /** ID do discipulador selecionado. */
  discipuladorId?: string;
};

/**
 * Item de opção de select (genérico, reaproveita `SelectOption`).
 */
type Opcao = { id: string; nome: string };

/**
 * Props aceitas pelo `<FiltrosMembros>`.
 */
export type FiltrosMembrosProps = {
  defaultValues: FiltrosMembrosDefaultValues;
  ministerios: Opcao[];
  discipuladores: Opcao[];
};

/** Opções fixas do filtro "tipo" (não vem do banco — é enum). */
const TIPO_OPTIONS = [
  { value: "VISITANTE", label: "Visitantes" },
  { value: "CONGREGADO", label: "Congregados" },
  { value: "MEMBRO_ATIVO", label: "Membros ativos" },
];

/**
 * @description Form de filtros (q, tipo, ministerioId, discipuladorId) com state em URL.
 * @param {FiltrosMembrosProps} props - Defaults e opções dos selects dependentes.
 * @returns {JSX.Element} Elemento do form.
 */
export function FiltrosMembros({
  defaultValues,
  ministerios,
  discipuladores,
}: FiltrosMembrosProps) {
  return (
    <Form
      method="get"
      action="/app/membros"
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end mb-6"
      role="search"
      aria-label="Filtrar membros"
    >
      <Input
        name="q"
        label="Buscar por nome"
        placeholder="Buscar por nome..."
        defaultValue={defaultValues.q}
        className="lg:col-span-1"
      />
      <Select
        name="tipo"
        label="Tipo"
        defaultValue={defaultValues.tipo ?? ""}
        placeholder="Todos os tipos"
        options={TIPO_OPTIONS}
      />
      <Select
        name="ministerioId"
        label="Ministério"
        defaultValue={defaultValues.ministerioId ?? ""}
        placeholder="Todos os ministérios"
        options={ministerios.map((m) => ({ value: m.id, label: m.nome }))}
      />
      <Select
        name="discipuladorId"
        label="Discipulador"
        defaultValue={defaultValues.discipuladorId ?? ""}
        placeholder="Todos os discipuladores"
        options={discipuladores.map((d) => ({
          value: d.id,
          label: d.nome,
        }))}
      />
      <div className="flex gap-2 sm:col-span-2 lg:col-span-4">
        <Button type="submit" variant="primary">
          Filtrar
        </Button>
        <Button as={Link} to="/app/membros" variant="ghost">
          Limpar
        </Button>
      </div>
    </Form>
  );
}
