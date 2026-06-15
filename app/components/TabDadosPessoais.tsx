/**
 * Componente <TabDadosPessoais /> — aba de dados pessoais (S03-T07).
 *
 * Renderiza os campos cadastrais eclesiásticos do membro + tipo atual
 * + botão "Promover → ..." quando aplicável.
 *
 * **RN-MEM-06:** a transição de tipo é **manual** (sem cron/scanner).
 * O botão "Promover" submete um form com `tipo={próximo}` para a
 * action dedicada `/app/membros/:id/tipo` (S03-T08) — **NÃO** para
 * a action do detail `/app/membros/:id` (essa só cuida de
 * `intent=delete`, ver DEB-MVP-1 / S06+).
 *
 * **Hierarquia de tipos:**
 * - VISITANTE → CONGREGADO
 * - CONGREGADO → MEMBRO_ATIVO
 * - MEMBRO_ATIVO: não tem próximo nível (botão some).
 *
 * **RBAC:** botão de promoção só aparece se `canPromover=true`
 * (ADMIN/PASTOR). O backend revalida (camada 3 — `assertCanWriteMembers`).
 *
 * @example
 *   <TabDadosPessoais membro={membro} canPromover={true} />
 *
 * @param props - Props do componente.
 * @returns Elemento JSX da tab.
 */
import { Form } from "react-router";
import { Button } from "~/components/Button";

/**
 * Subset de Membro usado pela tab.
 */
export type DadosPessoaisMembro = {
  id: string;
  nome: string;
  tipo: "VISITANTE" | "CONGREGADO" | "MEMBRO_ATIVO";
  profissao: string | null;
  estadoCivil: string | null;
  dataConversao: string | null;
  dataBatismo: string | null;
};

/**
 * Props aceitas pelo `<TabDadosPessoais>`.
 */
export type TabDadosPessoaisProps = {
  /** Membro foco da tab. */
  membro: DadosPessoaisMembro;
  /** Se `true`, renderiza botão de promoção de tipo. */
  canPromover: boolean;
};

/** Próximo tipo na hierarquia (null = último nível). */
function proximoTipo(
  tipo: DadosPessoaisMembro["tipo"]
): "CONGREGADO" | "MEMBRO_ATIVO" | null {
  if (tipo === "VISITANTE") return "CONGREGADO";
  if (tipo === "CONGREGADO") return "MEMBRO_ATIVO";
  return null;
}

/** Formata data ISO para PT-BR (dd/mm/aaaa). Retorna "—" se nula. */
function formatarData(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/** Labels de tipo em PT-BR. */
const TIPO_LABEL: Record<DadosPessoaisMembro["tipo"], string> = {
  VISITANTE: "Visitante",
  CONGREGADO: "Congregado",
  MEMBRO_ATIVO: "Membro ativo",
};

/** Classes Tailwind por tipo. */
const TIPO_CLASS: Record<DadosPessoaisMembro["tipo"], string> = {
  VISITANTE: "bg-amber-100 text-amber-800",
  CONGREGADO: "bg-blue-100 text-blue-800",
  MEMBRO_ATIVO: "bg-green-100 text-green-800",
};

/**
 * @description Tab de dados pessoais (campos + tipo + botão de promoção).
 * @param {TabDadosPessoaisProps} props - membro, canPromover.
 * @returns {JSX.Element} Elemento JSX da tab.
 */
export function TabDadosPessoais({ membro, canPromover }: TabDadosPessoaisProps) {
  const proximo = proximoTipo(membro.tipo);

  return (
    <div className="space-y-4" data-testid="tab-dados-pessoais">
      {/* Campos eclesiásticos */}
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-500">
            Data de conversão
          </dt>
          <dd className="text-slate-900 mt-0.5">
            {formatarData(membro.dataConversao)}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-500">
            Data de batismo
          </dt>
          <dd className="text-slate-900 mt-0.5">
            {formatarData(membro.dataBatismo)}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-500">
            Profissão
          </dt>
          <dd className="text-slate-900 mt-0.5">{membro.profissao ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-500">
            Estado civil
          </dt>
          <dd className="text-slate-900 mt-0.5">{membro.estadoCivil ?? "—"}</dd>
        </div>
      </dl>

      {/* Tipo + promoção (RN-MEM-06) */}
      <div className="border-t border-slate-200 pt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-700">Tipo atual:</span>
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${TIPO_CLASS[membro.tipo]}`}
          >
            {TIPO_LABEL[membro.tipo]}
          </span>
        </div>

        {canPromover && proximo && (
          <Form
            method="post"
            action={`/app/membros/${membro.id}/tipo`}
            className="inline"
          >
            <input type="hidden" name="tipo" value={proximo} />
            <Button type="submit" variant="primary" size="sm">
              Promover → {TIPO_LABEL[proximo]}
            </Button>
          </Form>
        )}
      </div>
    </div>
  );
}
