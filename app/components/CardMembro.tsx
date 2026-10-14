import { Form, Link } from "react-router";
import { cn } from "~/lib/cn";
import { getMembroStatus } from "./TabelaMembros";

export type MembroListItem = {
  id: string;
  nome: string;
  tipo: "VISITANTE" | "CONGREGADO" | "MEMBRO_ATIVO";
  email: string | null;
  createdAt: Date | string;
  discipulador?: { nome: string } | null;
  ministerios?: { nome: string }[];
  avatarUrl?: string | null;
};

export type CardMembroProps = {
  items: MembroListItem[];
  canEdit: boolean;
};

const TIPO_LABELS = {
  VISITANTE: "Visitante",
  CONGREGADO: "Congregado",
  MEMBRO_ATIVO: "Membro Efetivo",
} as const;

function Avatar({
  avatarUrl,
  nome,
}: {
  avatarUrl?: string | null;
  nome: string;
}) {
  const initials = nome
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={nome}
        className="h-10 w-10 rounded-full object-cover border border-surface-2 flex-shrink-0"
      />
    );
  }

  const colors = [
    "from-accent to-accent",
    "from-success to-teal-500",
    "from-rose-400 to-pink-500",
    "from-warning to-orange-500",
    "from-accent to-accent",
  ];
  const hash = nome
    .split("")
    .reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const gradient = colors[hash % colors.length];

  return (
    <div
      className={cn(
        "h-10 w-10 rounded-full bg-gradient-to-br flex items-center justify-center text-white text-sm font-semibold border border-surface-2 flex-shrink-0",
        gradient,
      )}
    >
      {initials}
    </div>
  );
}

function BadgeStatus({ status }: { status: "Ativo" | "Pendente" | "Inativo" }) {
  const styles = {
    Ativo: "bg-success-soft text-success border-success-soft",
    Pendente: "bg-warning-soft text-warning border-warning-soft",
    Inativo: "bg-danger-soft text-danger border-danger-soft",
  }[status];

  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border",
        styles,
      )}
    >
      {status}
    </span>
  );
}

function formatDate(iso: string | Date | null | undefined): string {
  if (!iso) return "—";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function CardMembro({ items, canEdit }: CardMembroProps) {
  return (
    <div className="md:hidden space-y-3">
      {items.map((m) => {
        const status = getMembroStatus(m.nome, m.tipo);
        return (
          <article
            key={m.id}
            className="border border-border rounded-lg bg-surface p-4 shadow-2xs space-y-3"
          >
            <div className="flex items-center gap-3">
              <Avatar avatarUrl={m.avatarUrl} nome={m.nome} />
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-bold text-fg truncate">
                  <Link
                    to={`/app/membros/${m.id}`}
                    className="hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded"
                  >
                    {m.nome}
                  </Link>
                </h3>
                {m.email && (
                  <p className="text-sm text-muted truncate">{m.email}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-sm pt-1 border-t border-surface-2">
              <div>
                <p className="text-xs uppercase font-semibold text-subtle">
                  Tipo
                </p>
                <p className="font-semibold text-fg mt-0.5">
                  {TIPO_LABELS[m.tipo]}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase font-semibold text-subtle">
                  Status
                </p>
                <div className="mt-0.5">
                  <BadgeStatus status={status} />
                </div>
              </div>
              <div className="col-span-2 pt-1">
                <p className="text-xs uppercase font-semibold text-subtle">
                  Data de Entrada
                </p>
                <p className="font-semibold text-fg mt-0.5">
                  {formatDate(m.createdAt)}
                </p>
              </div>
            </div>

            <div className="flex gap-2 pt-2 border-t border-surface-2 justify-end">
              <Link
                to={`/app/membros/${m.id}`}
                className="inline-flex items-center justify-center h-9 px-4 rounded-md text-sm font-semibold text-fg bg-surface-2 border border-border hover:bg-surface-2 transition-colors"
              >
                Detalhes
              </Link>
              {canEdit && (
                <Link
                  to={`/app/membros/${m.id}/editar`}
                  className="inline-flex items-center justify-center h-9 px-4 rounded-md text-sm font-semibold text-fg bg-surface-2 border border-border hover:bg-surface-2 transition-colors"
                >
                  Editar
                </Link>
              )}
              {canEdit && (
                <Form
                  method="post"
                  action={`/app/membros/${m.id}`}
                  className="inline"
                  onSubmit={(e) => {
                    if (
                      !window.confirm(
                        `Tem certeza que deseja excluir ${m.nome}? Esta ação não pode ser desfeita.`,
                      )
                    ) {
                      e.preventDefault();
                    }
                  }}
                >
                  <input type="hidden" name="intent" value="delete" />
                  <button
                    type="submit"
                    className="inline-flex items-center justify-center h-9 px-4 rounded-md text-sm font-semibold text-danger bg-danger-soft border border-danger-soft hover:bg-danger-soft transition-colors cursor-pointer"
                  >
                    Excluir
                  </button>
                </Form>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}
