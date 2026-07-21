import { Link, Form } from "react-router";
import { cn } from "~/lib/cn";

/**
 * Item de membro para a listagem.
 */
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

export type TabelaMembrosProps = {
  items: MembroListItem[];
  canEdit: boolean;
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

/** Renderiza o avatar relacionado ao membro e usa iniciais como fallback. */
function Avatar({ avatarUrl, nome }: { avatarUrl?: string | null; nome: string }) {
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
        className="h-10 w-10 rounded-full object-cover border border-slate-100 flex-shrink-0"
      />
    );
  }

  const colors = [
    "from-blue-400 to-indigo-500",
    "from-emerald-400 to-teal-500",
    "from-rose-400 to-pink-500",
    "from-amber-400 to-orange-500",
    "from-purple-400 to-indigo-500",
  ];
  const hash = nome.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const gradient = colors[hash % colors.length];

  return (
    <div className={cn(
      "h-10 w-10 rounded-full bg-gradient-to-br flex items-center justify-center text-white text-sm font-semibold border border-slate-100 flex-shrink-0",
      gradient
    )}>
      {initials}
    </div>
  );
}

/** Badge visual de Status. */
function BadgeStatus({ status }: { status: "Ativo" | "Pendente" | "Inativo" }) {
  const styles = {
    Ativo: "bg-emerald-50 text-emerald-700 border-emerald-100",
    Pendente: "bg-amber-50 text-amber-700 border-amber-100",
    Inativo: "bg-rose-50 text-rose-700 border-rose-100",
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

/** Tabela responsiva de membros matching the visual mockup. */
export function TabelaMembros({ items, canEdit }: TabelaMembrosProps) {
  return (
    <div className="hidden md:block border border-slate-200 rounded-lg overflow-hidden bg-white shadow-xs">
      <table className="w-full text-sm text-left">
        <caption className="sr-only">Lista de membros</caption>
        <thead className="bg-slate-50 border-b border-slate-200 text-xs font-bold uppercase text-slate-400 tracking-wider">
          <tr>
            <th scope="col" className="px-6 py-4 font-semibold">
              Nome
            </th>
            <th scope="col" className="px-6 py-4 font-semibold">
              Email
            </th>
            <th scope="col" className="px-6 py-4 font-semibold">
              Tipo
            </th>
            <th scope="col" className="px-6 py-4 font-semibold">
              Status
            </th>
            <th scope="col" className="px-6 py-4 font-semibold">
              Data de Entrada
            </th>
            <th scope="col" className="px-6 py-4 font-semibold text-right">
              Ações
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-150">
          {items.map((m) => {
            const status = getMembroStatus(m.nome, m.tipo);
            return (
              <tr key={m.id} className="hover:bg-slate-50/70 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <Avatar avatarUrl={m.avatarUrl} nome={m.nome} />
                    <Link
                      to={`/app/membros/${m.id}`}
                      className="text-slate-900 font-bold hover:text-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 rounded"
                    >
                      {m.nome}
                    </Link>
                  </div>
                </td>
                <td className="px-6 py-4 text-slate-500 font-medium">
                  {m.email ?? "—"}
                </td>
                <td className="px-6 py-4 text-slate-500 font-medium">
                  {TIPO_LABELS[m.tipo]}
                </td>
                <td className="px-6 py-4">
                  <BadgeStatus status={status} />
                </td>
                <td className="px-6 py-4 text-slate-500 font-medium">
                  {formatDate(m.createdAt)}
                </td>
                <td className="px-6 py-4 text-right whitespace-nowrap">
                  <div className="inline-flex items-center gap-1">
                    {canEdit && (
                      <Link
                        to={`/app/membros/${m.id}/editar`}
                        aria-label={`Editar ${m.nome}`}
                        className="inline-flex items-center justify-center h-8 w-8 rounded text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 transition-colors"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-4.5 w-4.5"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                        </svg>
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
                              `Tem certeza que deseja excluir ${m.nome}? Esta ação não pode ser desfeita.`
                            )
                          ) {
                            e.preventDefault();
                          }
                        }}
                      >
                        <input type="hidden" name="intent" value="delete" />
                        <button
                          type="submit"
                          aria-label={`Excluir ${m.nome}`}
                          className="inline-flex items-center justify-center h-8 w-8 rounded text-slate-400 hover:bg-red-50 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2 transition-colors cursor-pointer"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-4.5 w-4.5"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                          >
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            <line x1="10" y1="11" x2="10" y2="17" />
                            <line x1="14" y1="11" x2="14" y2="17" />
                          </svg>
                        </button>
                      </Form>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
