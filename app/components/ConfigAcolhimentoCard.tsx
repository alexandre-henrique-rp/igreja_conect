/**
 * Componente <ConfigAcolhimentoCard /> — card de configuração de acolhimento (S04-T05).
 *
 * Mostra o responsável atual pelo acolhimento de visitantes (nome + tipo).
 * Se `config` não for fornecido, exibe `<InfoBox tone="warning">` informando
 * que nenhum responsável foi configurado.
 *
 * @example
 *   <ConfigAcolhimentoCard
 *     config={{ tipo: "MEMBRO", nome: "João Paulo" }}
 *   />
 *
 * @example
 *   // Sem configuração
 *   <ConfigAcolhimentoCard />
 *
 * @param props - Props do componente.
 * @param props.config - Configuração atual (tipo + nome do responsável).
 * @returns Elemento JSX do card.
 */
import { InfoBox } from "./InfoBox";
import { cn } from "~/lib/cn";

/**
 * Configuração do responsável pelo acolhimento.
 */
export type ConfigAcolhimento = {
  /** Tipo do responsável: MEMBRO (pessoa específica) ou MINISTERIO (grupo). */
  tipo: "MEMBRO" | "MINISTERIO";
  /** Nome do responsável ou do ministério. */
  nome: string;
};

/**
 * Props aceitas pelo `<ConfigAcolhimentoCard>`.
 */
export type ConfigAcolhimentoCardProps = {
  /** Configuração atual. Se omitido, mostra warning. */
  config?: ConfigAcolhimento;
};

/** Cores do badge por tipo. */
const TIPO_BADGE: Record<string, string> = {
  MEMBRO: "bg-cyan-100 text-cyan-800",
  MINISTERIO: "bg-purple-100 text-purple-800",
};

/**
 * @description Card que exibe o responsável configurado para acolhimento.
 * @param {ConfigAcolhimentoCardProps} props - config opcional.
 * @returns {JSX.Element} Elemento JSX do card.
 */
export function ConfigAcolhimentoCard({
  config,
}: ConfigAcolhimentoCardProps) {
  if (!config) {
    return (
      <InfoBox tone="warning" title="Acolhimento">
        Nenhum responsável configurado
      </InfoBox>
    );
  }

  return (
    <div
      data-testid="config-acolhimento-card"
      className="border border-slate-200 rounded-lg p-4 bg-white space-y-2"
    >
      <h3 className="text-sm font-medium text-slate-500">
        Responsável pelo acolhimento
      </h3>
      <div className="flex items-center gap-3">
        <span className="text-lg font-semibold text-slate-900">
          {config.nome}
        </span>
        <span
          className={cn(
            "inline-block text-xs font-medium px-2 py-0.5 rounded-full",
            TIPO_BADGE[config.tipo] ?? "bg-slate-100 text-slate-700"
          )}
        >
          {config.tipo}
        </span>
      </div>
    </div>
  );
}
