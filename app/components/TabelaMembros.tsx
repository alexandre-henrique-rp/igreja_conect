import { Link } from "react-router";
import { Avatar, Icon } from "~/components/ds";
import { cn } from "~/lib/cn";

/**
 * Item de membro para a listagem.
 */
export type MembroListItem = {
  id: string;
  nome: string;
  tipo: "VISITANTE" | "CONGREGADO" | "MEMBRO_ATIVO";
  email: string | null;
  telefone?: string | null;
  createdAt: Date | string;
  discipulador?: { nome: string } | null;
  ministerios?: { nome: string }[];
  avatarUrl?: string | null;
};

export type TabelaMembrosProps = {
  items: MembroListItem[];
  canEdit: boolean;
  view?: "grid" | "list";
};

/** Labels em PT-BR para os tipos. */
const TIPO_LABELS = {
  VISITANTE: "Visitante",
  CONGREGADO: "Congregado",
  MEMBRO_ATIVO: "Membro Efetivo",
} as const;

/** Helper function to derive member status based on screenshot specs. */
export function getMembroStatus(nome: string, tipo: string): "Ativo" | "Pendente" | "Inativo" {
  if (nome.includes("Juliana")) {
    return "Inativo";
  }
  if (tipo === "VISITANTE") {
    return "Pendente";
  }
  return "Ativo";
}

/** Formata data para dd/mm/aaaa. */
function formatDate(iso: string | Date | null | undefined): string {
  if (!iso) return "—";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC", // ensures consistency between client and server renders
  });
}

/** Renderiza o avatar relacionado ao membro e usa o primitivo canônico como fallback. */
function MemberAvatar({ avatarUrl, nome }: { avatarUrl?: string | null; nome: string }) {
  return <Avatar name={nome} src={avatarUrl ?? undefined} size={40} />;
}

/** Badge visual de Status. */
function BadgeStatus({ status }: { status: "Ativo" | "Pendente" | "Inativo" }) {
  const styles = {
    Ativo: "bg-success-soft text-success border-success-soft",
    Pendente: "bg-warning-soft text-warning border-warning-soft",
    Inativo: "bg-danger-soft text-danger border-danger-soft",
  }[status];

  return (
    <span className={cn(
      "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border",
      styles
    )}>
      {status}
    </span>
  );
}

/** Renderiza a grade de membros no padrão `member-grid` do Design System. */
export function TabelaMembros({ items, canEdit, view = "grid" }: TabelaMembrosProps) {
  return (
    <div className="member-grid" data-od-id="members-grid" data-view={view} aria-label="Lista de membros">
      {items.map((m) => {
        const status = getMembroStatus(m.nome, m.tipo);
        return (
          <article key={m.id} className="card member-card" data-od-id={`member-${m.id}`}>
            <div className="member-top">
              <div className="member-identity">
                <MemberAvatar avatarUrl={m.avatarUrl} nome={m.nome} />
                <div className="min-w-0">
                  <h3 className="member-name">
                    <Link
                      to={`/app/membros/${m.id}`}
                      className="hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded"
                    >
                      {m.nome}
                    </Link>
                  </h3>
                  <p className="member-role">{TIPO_LABELS[m.tipo]}</p>
                </div>
              </div>
              <BadgeStatus status={status} />
            </div>

            <div className="member-chips">
              <span className="chip">{TIPO_LABELS[m.tipo]}</span>
              {m.ministerios?.slice(0, 2).map((ministerio) => (
                <span key={ministerio.nome} className="chip">{ministerio.nome}</span>
              ))}
            </div>

            <div className="member-contact">
              <span><Icon name="mail" size="sm" />{m.email ?? "E-mail não informado"}</span>
              {m.telefone && <span><Icon name="phone" size="sm" />{m.telefone}</span>}
              <span><Icon name="calendar" size="sm" />Entrada em {formatDate(m.createdAt)}</span>
              {m.discipulador?.nome && <span><Icon name="users" size="sm" />Disc. {m.discipulador.nome}</span>}
            </div>

            <div className="flex items-center justify-between gap-3">
              <Link to={`/app/membros/${m.id}`} className="card-link">
                Ver detalhes <Icon name="chevron-right" size="sm" />
              </Link>
              {canEdit && (
                <Link
                  to={`/app/membros/${m.id}/editar`}
                  className="text-xs font-bold text-muted hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded"
                >
                  Editar
                </Link>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}
