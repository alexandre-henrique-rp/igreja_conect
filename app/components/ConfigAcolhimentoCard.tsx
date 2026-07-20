import { cn } from "~/lib/cn";

/**
 * Configuração do responsável pelo acolhimento.
 */
export type ConfigAcolhimento = {
  /** Tipo do responsável: MEMBRO (pessoa específica) ou MINISTERIO (grupo). */
  tipo: "MEMBRO" | "MINISTERIO";
  /** Nome do responsável ou do ministério. */
  nome: string;
  /** ID do responsável. */
  id?: string;
};

/** Props aceitas pelo `<ConfigAcolhimentoCard>`. */
export type ConfigAcolhimentoCardProps = {
  /** Configuração atual. Se omitido, mostra warning. */
  config?: ConfigAcolhimento;
};

/** Cores do badge por tipo. */
const TIPO_BADGE: Record<string, string> = {
  MEMBRO: "bg-blue-100 text-blue-700 border border-blue-200",
  MINISTERIO: "bg-indigo-100 text-indigo-700 border border-indigo-200",
};

/**
 * @description Card que exibe o responsável configurado para acolhimento de visitantes.
 * @param {ConfigAcolhimentoCardProps} props - config opcional.
 * @returns {JSX.Element} Elemento JSX do card.
 */
export function ConfigAcolhimentoCard({
  config,
}: ConfigAcolhimentoCardProps) {
  if (!config) {
    return (
      <div className="p-6 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-4" data-testid="config-acolhimento-card">
        <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center shrink-0">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <div>
          <h4 className="text-base font-bold text-amber-950">Acolhimento de Visitantes</h4>
          <p className="text-sm text-amber-700 mt-1">Nenhum responsável configurado. Novos visitantes não dispararão notificações automáticas.</p>
        </div>
      </div>
    );
  }

  const isMembro = config.tipo === "MEMBRO";

  return (
    <div
      data-testid="config-acolhimento-card"
      className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex items-center gap-5 hover:shadow-md transition-shadow"
    >
      <div className={cn(
        "w-14 h-14 rounded-xl flex items-center justify-center shrink-0",
        isMembro ? "bg-blue-50 text-blue-600" : "bg-indigo-50 text-indigo-600"
      )}>
        {isMembro ? (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-7 w-7"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
          </svg>
        ) : (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-7 w-7"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4" />
          </svg>
        )}
      </div>
      <div>
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Responsável pelo Acolhimento</p>
        <div className="flex items-center gap-2.5 mt-1.5 flex-wrap">
          <span className="text-xl font-bold text-slate-900 leading-none font-headline">
            {config.nome}
          </span>
          <span
            className={cn(
              "inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
              TIPO_BADGE[config.tipo] ?? "bg-slate-100 text-slate-700"
            )}
          >
            {config.tipo === "MEMBRO" ? "Membro" : "Ministério"}
          </span>
        </div>
      </div>
    </div>
  );
}
