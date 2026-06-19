/**
 * Componente <CardFidelidade /> — wrapper de fidelidade financeira (S08-T03).
 *
 * Se `data === null`: renderiza card com mensagem de acesso negado + ícone cadeado.
 * Se `data !== null`: renderiza `<ResumoFinanceiro>` + `<TabelaDizimos>` empilhados.
 *
 * **RBAC (defense in depth — 3 camadas):**
 * 1. **UI (camada 1):** fallback amigável para SECRETARIO (não mostra 403, mostra card).
 * 2. **Loader (camada 2):** `getFidelidadeFinanceira` retorna null para perfis sem acesso.
 * 3. **Service (camada 3):** `canSeeFinancials` filtra antes de chamar `getDizimosByMembro`.
 *
 * @example
 *   <CardFidelidade data={fidelidadeFinanceira} />
 *
 * @param props - Props do componente.
 * @param props.data - Dados de fidelidade (null se sem permissão).
 * @returns Elemento JSX.
 */
import { ResumoFinanceiro } from "~/components/fidelidade/ResumoFinanceiro";
import { TabelaDizimos } from "~/components/fidelidade/TabelaDizimos";

/**
 * Dados de retorno de `getFidelidadeFinanceira`.
 */
export type FidelidadeFinanceiraData = {
  dizimos: Array<{
    id: string;
    valorCentavos: number;
    dataCompetencia: Date;
    caixaId: string;
    caixaNome: string;
  }>;
  totalCentavos: number;
  mesesComDizimo: number;
};

/**
 * Props aceitas pelo `<CardFidelidade>`.
 */
export type CardFidelidadeProps = {
  /** Dados de fidelidade (null se usuário sem permissão). */
  data: FidelidadeFinanceiraData | null;
};

/**
 * Ícone de cadeado (SVG inline, aria-hidden).
 */
function LockIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-12 w-12 text-slate-300"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
      />
    </svg>
  );
}

/**
 * @description Wrapper de fidelidade financeira com fallback para sem acesso.
 * @param {CardFidelidadeProps} props - data.
 * @returns {JSX.Element} Card de fidelidade ou fallback.
 */
export function CardFidelidade({ data }: CardFidelidadeProps) {
  if (data === null) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex flex-col items-center justify-center rounded-lg border border-slate-200 bg-white p-8 text-center space-y-3"
        data-testid="card-fidelidade-sem-acesso"
      >
        <LockIcon />
        <p className="text-slate-700 font-medium">
          Você não tem permissão para ver dados financeiros detalhados
        </p>
        <p className="text-sm text-slate-500">
          Apenas perfis ADMIN, PASTOR e FINANCEIRO podem visualizar dízimos.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="card-fidelidade">
      <ResumoFinanceiro
        totalCentavos={data.totalCentavos}
        mesesComDizimo={data.mesesComDizimo}
        quantidadeDizimos={data.dizimos.length}
      />
      <TabelaDizimos dizimos={data.dizimos} />
    </div>
  );
}
