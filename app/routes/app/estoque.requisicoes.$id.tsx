import type { Route } from "./+types/estoque.requisicoes.$id";
import { Link, useActionData } from "react-router";
import { data } from "react-router";
import { userContext } from "~/lib/user-context";
import { assertCanSeeEstoque, assertCanManageEstoque } from "~/lib/rbac.server";
import {
  obterRequisicao,
  aprovarRequisicao,
  rejeitarRequisicao,
  comprarRequisicao,
} from "~/lib/requisicaoCompra.server";
import { parseBRLToCents } from "~/lib/money-format";

export function meta() {
  return [{ title: "Requisição de Compra · Igreja Conect" }];
}

export async function loader({ params, context }: Route.LoaderArgs) {
  const user = context.get(userContext);
  if (!user) throw new Response("Não autenticado.", { status: 401 });
  assertCanSeeEstoque(user);

  const req = await obterRequisicao(params.id, user);
  if (!req) throw new Response("Requisição não encontrada.", { status: 404 });

  const podeGerenciar =
    !!user.cargo &&
    ["ADMIN", "PASTOR", "SECRETARIO"].includes(user.cargo);

  return { req, podeGerenciar };
}

export async function action({ request, params, context }: Route.ActionArgs) {
  const user = context.get(userContext);
  if (!user) throw new Response("Não autenticado.", { status: 401 });

  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "");

  try {
    if (intent === "aprovar") {
      assertCanManageEstoque(user);
      await aprovarRequisicao(
        { id: params.id, observacao: String(formData.get("observacao") ?? "") || undefined },
        user,
      );
      return { success: true, message: "Requisição aprovada!" };
    }

    if (intent === "rejeitar") {
      assertCanManageEstoque(user);
      const observacao = String(formData.get("observacao") ?? "");
      if (observacao.length < 5) {
        return data(
          { success: false, error: "Informe o motivo da rejeição (mín. 5 caracteres)." },
          { status: 422 },
        );
      }
      await rejeitarRequisicao({ id: params.id, observacao }, user);
      return { success: true, message: "Requisição rejeitada." };
    }

    if (intent === "comprar") {
      assertCanManageEstoque(user);
      const valorDisplay = String(formData.get("valorDisplay") ?? "");
      const valorCentavos = parseBRLToCents(valorDisplay);
      if (!valorCentavos || valorCentavos <= 0) {
        return data(
          { success: false, error: "Informe um valor válido para a compra." },
          { status: 422 },
        );
      }
      await comprarRequisicao(
        {
          id: params.id,
          valorCentavos,
          observacao: String(formData.get("observacao") ?? "") || undefined,
        },
        user,
      );
      return { success: true, message: "Compra registrada! Estoque atualizado." };
    }

    return data({ success: false, error: "Operação inválida." }, { status: 400 });
  } catch (err: unknown) {
    if (err instanceof Response) throw err;
    return data(
      { success: false, error: "Erro ao processar a operação. Tente novamente." },
      { status: 500 },
    );
  }
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

export default function DetalheRequisicao({ loaderData, actionData }: Route.ComponentProps) {
  const { req, podeGerenciar } = loaderData;
  const result = actionData as { success?: boolean; message?: string; error?: string } | undefined;

  return (
    <main className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto w-full space-y-6 bg-slate-50 min-h-screen">
      <div className="flex items-start justify-between">
        <div>
          <nav className="flex items-center gap-2 text-xs font-semibold text-slate-400 mb-2">
            <Link to="/app/estoque" className="hover:text-slate-600">Estoque</Link>
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
            <Link to="/app/estoque/requisicoes" className="hover:text-slate-600">Requisições</Link>
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
            <span className="text-blue-600">Detalhe</span>
          </nav>
          <h2 className="text-2xl font-bold text-slate-900">Requisição de Compra</h2>
        </div>
        <Link
          to="/app/estoque/requisicoes"
          className="px-4 h-10 flex items-center border border-slate-200 text-slate-600 bg-white rounded-lg font-semibold hover:bg-slate-50 transition-all text-sm"
        >
          Voltar
        </Link>
      </div>

      {result?.success && (
        <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700">
          {result.message}
        </div>
      )}
      {result && !result.success && result.error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {result.error}
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900">{req.nomeItem}</h3>
          <span className={`inline-flex px-3 py-1 rounded-full text-sm font-semibold border ${STATUS_COLOR[req.status]}`}>
            {STATUS_LABEL[req.status]}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <dt className="text-xs font-semibold text-slate-400 uppercase">Quantidade</dt>
            <dd className="text-sm text-slate-700 mt-1">{req.quantidade} un.</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold text-slate-400 uppercase">Data da Solicitação</dt>
            <dd className="text-sm text-slate-700 mt-1">
              {new Date(req.createdAt).toLocaleString("pt-BR")}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold text-slate-400 uppercase">Solicitado por</dt>
            <dd className="text-sm text-slate-700 mt-1">{req.solicitadoPor.nome}</dd>
          </div>
          {req.aprovadoPor && (
            <div>
              <dt className="text-xs font-semibold text-slate-400 uppercase">Aprovado/Rejeitado por</dt>
              <dd className="text-sm text-slate-700 mt-1">{req.aprovadoPor.nome}</dd>
            </div>
          )}
          {req.compradoPor && (
            <div>
              <dt className="text-xs font-semibold text-slate-400 uppercase">Comprado por</dt>
              <dd className="text-sm text-slate-700 mt-1">{req.compradoPor.nome}</dd>
            </div>
          )}
          {req.valorCentavos != null && (
            <div>
              <dt className="text-xs font-semibold text-slate-400 uppercase">Valor da Compra</dt>
              <dd className="text-sm text-slate-700 mt-1">
                R$ {(req.valorCentavos / 100).toFixed(2)}
              </dd>
            </div>
          )}
          {req.itemEstoque && (
            <div>
              <dt className="text-xs font-semibold text-slate-400 uppercase">Item Vinculado</dt>
              <dd className="text-sm text-slate-700 mt-1">
                <Link to={`/app/estoque/${req.itemEstoque.id}`} className="text-blue-600 hover:underline">
                  {req.itemEstoque.nome}
                </Link>
              </dd>
            </div>
          )}
        </div>

        {req.justificativa && (
          <div>
            <dt className="text-xs font-semibold text-slate-400 uppercase">Justificativa</dt>
            <dd className="text-sm text-slate-700 mt-1">{req.justificativa}</dd>
          </div>
        )}

        {req.observacao && (
          <div>
            <dt className="text-xs font-semibold text-slate-400 uppercase">Observação</dt>
            <dd className="text-sm text-slate-700 mt-1">{req.observacao}</dd>
          </div>
        )}
      </div>

      {podeGerenciar && req.status === "SOLICITADA" && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
          <h3 className="font-semibold text-slate-900">Aprovar ou Rejeitar</h3>
          <div className="space-y-3">
            <div className="space-y-1">
              <label htmlFor="observacao" className="block text-sm font-medium text-slate-700">
                Observação (opcional para aprovar, obrigatória para rejeitar)
              </label>
              <textarea
                id="observacao"
                name="observacao"
                rows={2}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                placeholder="Ex: Aprovado. Comprar até sexta. / Rejeitado: item não prioritário no momento."
              />
            </div>
            <div className="flex items-center gap-3">
              <form method="POST" className="inline">
                <input type="hidden" name="intent" value="aprovar" />
                <button
                  type="submit"
                  className="inline-flex items-center justify-center rounded-md bg-emerald-600 px-6 h-11 text-sm font-medium text-white hover:bg-emerald-700 transition-colors"
                >
                  Aprovar
                </button>
              </form>
              <form method="POST" className="inline">
                <input type="hidden" name="intent" value="rejeitar" />
                <button
                  type="submit"
                  className="inline-flex items-center justify-center rounded-md bg-red-600 px-6 h-11 text-sm font-medium text-white hover:bg-red-700 transition-colors"
                >
                  Rejeitar
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {podeGerenciar && req.status === "APROVADA" && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
          <h3 className="font-semibold text-slate-900">Registrar Compra</h3>
          <p className="text-sm text-slate-500">
            Informe o valor pago. Ao registrar a compra, o estoque do item vinculado será atualizado automaticamente.
          </p>
          <form method="POST" className="space-y-3">
            <input type="hidden" name="intent" value="comprar" />
            <div className="space-y-1">
              <label htmlFor="valorDisplay" className="block text-sm font-medium text-slate-700">
                Valor da Compra (R$) <span className="text-red-600">*</span>
              </label>
              <input
                id="valorDisplay"
                name="valorDisplay"
                type="text"
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                placeholder="0,00"
                required
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="compraObservacao" className="block text-sm font-medium text-slate-700">
                Observação (opcional)
              </label>
              <textarea
                id="compraObservacao"
                name="observacao"
                rows={2}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                placeholder="Ex: Comprado no mercado X, NF 12345."
              />
            </div>
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-md bg-blue-600 px-6 h-11 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
            >
              Registrar Compra
            </button>
          </form>
        </div>
      )}

      {req.status === "COMPRADA" && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 text-center">
          <p className="text-sm font-semibold text-emerald-700">
            Esta requisição foi comprada e o estoque foi atualizado.
          </p>
        </div>
      )}

      {req.status === "REJEITADA" && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <p className="text-sm font-semibold text-red-700">
            Esta requisição foi rejeitada.
          </p>
        </div>
      )}
    </main>
  );
}
