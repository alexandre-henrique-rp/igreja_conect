import type { Route } from "./+types/estoque.requisicoes._index";
import { Link, useNavigate } from "react-router";
import { userContext } from "~/lib/user-context";
import { assertCanSeeEstoque } from "~/lib/rbac.server";
import { listarRequisicoes } from "~/lib/requisicaoCompra.server";

export function meta() {
  return [{ title: "Requisições de Compra · Igreja Conect" }];
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const user = context.get(userContext);
  if (!user) throw new Response("Não autenticado.", { status: 401 });
  assertCanSeeEstoque(user);

  const url = new URL(request.url);
  const status = url.searchParams.get("status") || "";

  const { requisicoes, total } = await listarRequisicoes(
    { status: status || undefined, pageSize: 100 },
    user,
  );

  const podeGerenciar =
    !!user.cargo &&
    ["ADMIN", "PASTOR", "SECRETARIO"].includes(user.cargo);

  return { requisicoes, total, status, podeGerenciar };
}

const STATUS_LABEL: Record<string, string> = {
  SOLICITADA: "Solicitada",
  APROVADA: "Aprovada",
  REJEITADA: "Rejeitada",
  COMPRADA: "Comprada",
};

const STATUS_COLOR: Record<string, string> = {
  SOLICITADA: "bg-warning-soft text-warning border-warning-soft",
  APROVADA: "bg-accent-soft-2 text-accent-strong border-accent-soft",
  REJEITADA: "bg-danger-soft text-danger border-danger-soft",
  COMPRADA: "bg-success-soft text-success border-success-soft",
};

export default function RequisicoesCompra({ loaderData }: Route.ComponentProps) {
  const { requisicoes, total, status, podeGerenciar } = loaderData;
  const navigate = useNavigate();

  return (
    <main className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6 bg-surface-2 min-h-screen">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <nav className="flex items-center gap-2 text-xs font-semibold text-subtle mb-2">
            <Link to="/app/estoque" className="hover:text-muted">Estoque</Link>
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
            <span className="text-accent">Requisições de Compra</span>
          </nav>
          <h2 className="text-3xl font-extrabold text-fg tracking-tight">Requisições de Compra</h2>
          <p className="text-muted text-sm mt-1">Solicite, aprove e registre compras de itens para o estoque.</p>
        </div>
        <div className="flex items-center gap-3">
          {podeGerenciar && (
            <Link
              to="/app/estoque/requisicoes/nova"
              className="flex items-center justify-center gap-2 px-4 h-10 bg-accent text-white rounded-lg font-semibold hover:bg-accent-strong transition-all text-sm"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Nova Requisição
            </Link>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {["", "SOLICITADA", "APROVADA", "REJEITADA", "COMPRADA"].map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => navigate(s ? `/app/estoque/requisicoes?status=${s}` : "/app/estoque/requisicoes")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
              status === s
                ? "bg-accent text-white border-accent"
                : "bg-surface text-muted border-border hover:bg-surface-2"
            }`}
          >
            {s === "" ? "Todas" : STATUS_LABEL[s]}
          </button>
        ))}
      </div>

      <div className="bg-surface rounded-xl border border-border overflow-hidden">
        {requisicoes.length === 0 ? (
          <div className="p-8 text-center text-subtle space-y-2">
            <p className="font-semibold text-muted">Nenhuma requisição encontrada</p>
            <p className="text-xs">Crie uma nova requisição de compra para começar.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-surface-2/50">
                <th className="px-6 py-3 text-left text-xs font-semibold text-muted uppercase">Item</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-muted uppercase">Qtd</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-muted uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-muted uppercase">Solicitado por</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-muted uppercase">Data</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-muted uppercase">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-2">
              {requisicoes.map((req) => (
                <tr key={req.id} className="hover:bg-surface-2/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="text-sm font-semibold text-fg">{req.nomeItem}</div>
                    {req.itemEstoque && (
                      <div className="text-xs text-subtle">Vinculado a: {req.itemEstoque.nome}</div>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-fg">{req.quantidade}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2 py-1 rounded-full text-xs font-semibold border ${STATUS_COLOR[req.status]}`}>
                      {STATUS_LABEL[req.status]}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-muted">{req.solicitadoPor.nome}</td>
                  <td className="px-6 py-4 text-sm text-muted">
                    {new Date(req.createdAt).toLocaleDateString("pt-BR")}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link
                      to={`/app/estoque/requisicoes/${req.id}`}
                      className="text-xs font-semibold text-accent hover:text-accent-strong cursor-pointer"
                    >
                      Ver detalhes
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="p-4 border-t border-surface-2 text-xs text-muted">
          Mostrando {requisicoes.length} de {total} requisição(ões)
        </div>
      </div>
    </main>
  );
}
