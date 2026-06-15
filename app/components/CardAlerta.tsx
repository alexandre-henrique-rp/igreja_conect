/**
 * Componente <CardAlerta /> — card individual de alerta (S04-T07).
 *
 * Exibe um alerta com:
 * - Borda esquerda cyan-600 se não lido.
 * - Opacidade reduzida (opacity-75) se resolvido.
 * - Título + mensagem + RelativeTime.
 * - Form com `_action="marcarLido"` ou `_action="marcarResolvido"`.
 * - Link "Ver membro" se alerta.membroId presente.
 *
 * @example
 *   <CardAlerta
 *     alerta={{ id: "a1", titulo: "...", mensagem: "...", createdAt: new Date(), lidoEm: null, resolvidoEm: null }}
 *     user={{ nome: "Admin", cargo: "ADMIN" }}
 *     now={new Date()}
 *   />
 *
 * @param props - Props do componente.
 * @param props.alerta - Dados do alerta.
 * @param props.user - Usuário logado (opcional; reservado para contexto futuro).
 * @param props.now - Referência de "agora" para RelativeTime.
 * @param props.canResolve - Se true, mostra ação de resolver quando aplicável.
 * @returns Elemento JSX do card.
 */
import { Form, Link } from "react-router";
import { RelativeTime } from "./RelativeTime";
import { cn } from "~/lib/cn";

/**
 * Dados de um alerta.
 */
export type AlertaData = {
  /** ID único do alerta. */
  id: string;
  /** Título do alerta. */
  titulo: string;
  /** Mensagem descritiva. */
  mensagem: string;
  /** Data de criação. */
  createdAt: Date;
  /** Se este destinatário já leu o alerta. */
  lido: boolean;
  /** Se este alerta já foi resolvido. */
  resolvido: boolean;
  /** ID do membro relacionado (opcional). */
  membroId?: string;
};

/**
 * Usuário logado (para ações).
 */
export type AlertaUser = {
  nome: string;
  cargo: string;
};

/**
 * Props aceitas pelo `<CardAlerta>`.
 */
export type CardAlertaProps = {
  /** Dados do alerta. */
  alerta: AlertaData;
  /** Usuário logado (opcional). */
  user?: AlertaUser;
  /** Referência de "agora" para RelativeTime (opcional). */
  now?: Date;
  /** Se o usuário pode resolver alertas. */
  canResolve?: boolean;
};

/**
 * @description Card de alerta com ações de leitura/resolução e link para membro.
 * @param {CardAlertaProps} props - alerta, user, now.
 * @returns {JSX.Element} Elemento do card.
 */
export function CardAlerta({ alerta, user: _user, now, canResolve = false }: CardAlertaProps) {
  const { id, titulo, mensagem, createdAt, lido, resolvido, membroId } =
    alerta;

  const isNaoLido = !lido && !resolvido;
  const isResolvido = resolvido;

  return (
    <div
      data-testid="card-alerta"
      className={cn(
        "border border-slate-200 rounded-lg bg-white p-4 space-y-2 transition-opacity",
        isNaoLido && "border-l-4 border-l-cyan-600",
        isResolvido && "opacity-75"
      )}
    >
      {/* Header: título + hora */}
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-900">{titulo}</h3>
        <RelativeTime date={createdAt} now={now} className="shrink-0" />
      </div>

      {/* Mensagem */}
      <p className="text-sm text-slate-700">{mensagem}</p>

      {/* Ações */}
      <div className="flex items-center gap-2 pt-1">
        {isNaoLido && (
          <Form method="post" className="inline">
            <input type="hidden" name="alertaId" value={id} />
            <input type="hidden" name="_action" value="marcarLido" />
            <button
              type="submit"
              className="text-xs font-medium text-cyan-700 hover:text-cyan-800 underline underline-offset-2"
            >
              Marcar lido
            </button>
          </Form>
        )}

        {lido && !resolvido && canResolve && (
          <Form method="post" className="inline">
            <input type="hidden" name="alertaId" value={id} />
            <input type="hidden" name="_action" value="marcarResolvido" />
            <button
              type="submit"
              className="text-xs font-medium text-cyan-700 hover:text-cyan-800 underline underline-offset-2"
            >
              Resolver
            </button>
          </Form>
        )}

        {membroId && (
          <Link
            to={`/app/membros/${membroId}`}
            className="text-xs font-medium text-slate-500 hover:text-slate-700 underline underline-offset-2"
          >
            Ver membro
          </Link>
        )}
      </div>
    </div>
  );
}
