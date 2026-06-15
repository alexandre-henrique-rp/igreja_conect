/**
 * Componente <Saudacao /> — saudação ao usuário logado (S04-T10).
 *
 * Exibe "Bom dia"/"Boa tarde"/"Boa noite" conforme o horário.
 * Se `showHint=true`, mostra um hint contextual sobre alertas.
 *
 * Aceita `horaParam` para testabilidade (evita Date().getHours() no render).
 *
 * @example
 *   <Saudacao user={{ nome: "João" }} showHint={alertasNaoLidos > 0} />
 *
 * @param props - Props do componente.
 * @param props.user - Dados do usuário logado.
 * @param props.showHint - Se true, exibe hint sobre alertas não lidos.
 * @param props.horaParam - Hora para determinar saudação (opcional, testabilidade).
 * @returns Elemento JSX.
 */
import { cn } from "~/lib/cn";

/**
 * Props aceitas pelo `<Saudacao>`.
 */
export type SaudacaoProps = {
  /** Dados do usuário. */
  user: { nome: string };
  /** Se true, exibe hint sobre alertas não lidos. */
  showHint?: boolean;
  /** Hora para cálculo da saudação (opcional — default = new Date().getHours()). */
  horaParam?: number;
};

/**
 * Retorna saudação baseada na hora.
 */
function saudacaoPorHora(hora: number): string {
  if (hora < 12) return "Bom dia";
  if (hora < 18) return "Boa tarde";
  return "Boa noite";
}

/**
 * @description Saudação personalizada com horário e hint opcional.
 * @param {SaudacaoProps} props - user, showHint, horaParam.
 * @returns {JSX.Element} Elemento JSX.
 */
export function Saudacao({ user, showHint, horaParam }: SaudacaoProps) {
  const hora = horaParam ?? new Date().getHours();
  const saudacao = saudacaoPorHora(hora);

  return (
    <header data-testid="saudacao" className="mb-6">
      <h1 className="text-2xl font-bold text-slate-900">
        {saudacao}, {user.nome}.
      </h1>
      {showHint && (
        <p className="text-sm text-slate-600 mt-1">
          Você tem alertas não lidos.
        </p>
      )}
    </header>
  );
}
