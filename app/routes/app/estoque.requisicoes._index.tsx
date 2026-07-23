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
  SOLICITADA: "bg-amber-100 text-amber-700 border-amber-200",
  APROVADA: "bg-blue-100 text-blue-700 border-blue-200",
  REJEITADA: "bg-red-100 text-red-700 border-red-200",
  COMPRADA: "bg-emerald-100 text-emerald-700 border-emerald-200",
};

export default function RequisicoesCompra({ loaderData }: Route.ComponentProps) {
  const { requisicoes, total, status, podeGerenciar } = loaderData;
  const navigate = useNavigate();

  return (
    <main className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6 bg-slate-50 min-h-screen">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <nav className="flex items-center gap-2 text-xs font-semibold text-slate-400 mb-2">
            <Link to="/app/estoque" className="hover:text-slate-600">Estoque</Link>
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
            <span className="text-blue-600">Requisições de Compra</span>
          </nav>
          <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Requisições de Compra</h2>
          <p className="text-slate-500 text-sm mt-1">Solicite, aprove e registre compras de itens para o estoque.</p>
        </div>
        <div className="flex items-center gap-3">
          {podeGerenciar && (
            <Link
              to="/app/estoque/requisicoes/nova"
              className="flex items-center justify-center gap-2 px-4 h-10 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-all text-sm"
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
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
            }`}
          >
            {s === "" ? "Todas" : STATUS_LABEL[s]}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {requisicoes.length === 0 ? (
          <div className="p-8 text-center text-slate-400 space-y-2">
            <p className="font-semibold text-slate-600">Nenhuma requisição encontrada</p>
            <p className="text-xs">Crie uma nova requisição de compra para começar.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/50">
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Item</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Qtd</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Solicitado por</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Data</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {requisicoes.map((req) => (
                <tr key={req.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="text-sm font-semibold text-slate-900">{req.nomeItem}</div>
                    {req.itemEstoque && (
                      <div className="text-xs text-slate-400">Vinculado a: {req.itemEstoque.nome}</div>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-700">{req.quantidade}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2 py-1 rounded-full text-xs font-semibold border ${STATUS_COLOR[req.status]}`}>
                      {STATUS_LABEL[req.status]}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">{req.solicitadoPor.nome}</td>
                  <td className="px-6 py-4 text-sm text-slate-500">
                    {new Date(req.createdAt).toLocaleDateString("pt-BR")}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link
                      to={`/app/estoque/requisicoes/${req.id}`}
                      className="text-xs font-semibold text-blue-600 hover:text-blue-700 cursor-pointer"
                    >
                      Ver detalhes
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="p-4 border-t border-slate-100 text-xs text-slate-500">
          Mostrando {requisicoes.length} de {total} requisição(ões)
        </div>
      </div>
    </main>
  );
}
