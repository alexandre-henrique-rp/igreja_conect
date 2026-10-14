import { data, Link } from "react-router";
import { listarCaixasParaSelect } from "~/lib/caixas.server";
import { formatBRLFromCents, parseBRLToCents } from "~/lib/money-format";
import { assertCanManageEstoque, assertCanSeeEstoque } from "~/lib/rbac.server";
import {
  aprovarRequisicao,
  comprarRequisicao,
  obterRequisicao,
  rejeitarRequisicao,
} from "~/lib/requisicaoCompra.server";
import { userContext } from "~/lib/user-context";
import type { Route } from "./+types/estoque.requisicoes.$id";

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
    !!user.cargo && ["ADMIN", "PASTOR", "SECRETARIO"].includes(user.cargo);

  const caixas = podeGerenciar ? await listarCaixasParaSelect(user) : [];

  return { req, podeGerenciar, caixas };
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
        {
          id: params.id,
          observacao: String(formData.get("observacao") ?? "") || undefined,
        },
        user,
      );
      return { success: true, message: "Requisição aprovada!" };
    }

    if (intent === "rejeitar") {
      assertCanManageEstoque(user);
      const observacao = String(formData.get("observacao") ?? "");
      if (observacao.length < 5) {
        return data(
          {
            success: false,
            error: "Informe o motivo da rejeição (mín. 5 caracteres).",
          },
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
          caixaId: String(formData.get("caixaId") ?? "") || undefined,
        },
        user,
      );
      return {
        success: true,
        message: "Compra registrada! Estoque atualizado.",
      };
    }

    return data(
      { success: false, error: "Operação inválida." },
      { status: 400 },
    );
  } catch (err: unknown) {
    if (err instanceof Response) throw err;
    return data(
      {
        success: false,
        error: "Erro ao processar a operação. Tente novamente.",
      },
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
  SOLICITADA: "bg-warning-soft text-warning border-warning-soft",
  APROVADA: "bg-accent-soft-2 text-accent-strong border-accent-soft",
  REJEITADA: "bg-danger-soft text-danger border-danger-soft",
  COMPRADA: "bg-success-soft text-success border-success-soft",
};

export default function DetalheRequisicao({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const { req, podeGerenciar, caixas } = loaderData;
  const result = actionData as
    | { success?: boolean; message?: string; error?: string }
    | undefined;

  return (
    <main className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto w-full space-y-6 bg-surface-2 min-h-screen">
      <div className="flex items-start justify-between">
        <div>
          <nav className="flex items-center gap-2 text-xs font-semibold text-subtle mb-2">
            <Link to="/app/estoque" className="hover:text-muted">
              Estoque
            </Link>
            <svg
              className="w-3 h-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="3"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 5l7 7-7 7"
              />
            </svg>
            <Link to="/app/estoque/requisicoes" className="hover:text-muted">
              Requisições
            </Link>
            <svg
              className="w-3 h-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="3"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 5l7 7-7 7"
              />
            </svg>
            <span className="text-accent">Detalhe</span>
          </nav>
          <h2 className="text-2xl font-bold text-fg">Requisição de Compra</h2>
        </div>
        <Link
          to="/app/estoque/requisicoes"
          className="px-4 h-10 flex items-center border border-border text-muted bg-surface rounded-lg font-semibold hover:bg-surface-2 transition-all text-sm"
        >
          Voltar
        </Link>
      </div>

      {result?.success && (
        <div className="rounded-lg bg-success-soft border border-success-soft px-4 py-3 text-sm text-success">
          {result.message}
        </div>
      )}
      {result && !result.success && result.error && (
        <div className="rounded-lg bg-danger-soft border border-danger-soft px-4 py-3 text-sm text-danger">
          {result.error}
        </div>
      )}

      <div className="bg-surface rounded-xl border border-border p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-fg">{req.nomeItem}</h3>
          <span
            className={`inline-flex px-3 py-1 rounded-full text-sm font-semibold border ${STATUS_COLOR[req.status]}`}
          >
            {STATUS_LABEL[req.status]}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <dt className="text-xs font-semibold text-subtle uppercase">
              Quantidade
            </dt>
            <dd className="text-sm text-fg mt-1">{req.quantidade} un.</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold text-subtle uppercase">
              Data da Solicitação
            </dt>
            <dd className="text-sm text-fg mt-1">
              {new Date(req.createdAt).toLocaleString("pt-BR")}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold text-subtle uppercase">
              Solicitado por
            </dt>
            <dd className="text-sm text-fg mt-1">{req.solicitadoPor.nome}</dd>
          </div>
          {req.aprovadoPor && (
            <div>
              <dt className="text-xs font-semibold text-subtle uppercase">
                Aprovado/Rejeitado por
              </dt>
              <dd className="text-sm text-fg mt-1">{req.aprovadoPor.nome}</dd>
            </div>
          )}
          {req.compradoPor && (
            <div>
              <dt className="text-xs font-semibold text-subtle uppercase">
                Comprado por
              </dt>
              <dd className="text-sm text-fg mt-1">{req.compradoPor.nome}</dd>
            </div>
          )}
          {req.valorCentavos != null && (
            <div>
              <dt className="text-xs font-semibold text-subtle uppercase">
                Valor da Compra
              </dt>
              <dd className="text-sm text-fg mt-1">
                {formatBRLFromCents(req.valorCentavos)}
              </dd>
            </div>
          )}
          {req.itemEstoque && (
            <div>
              <dt className="text-xs font-semibold text-subtle uppercase">
                Item Vinculado
              </dt>
              <dd className="text-sm text-fg mt-1">
                <Link
                  to={`/app/estoque/${req.itemEstoque.id}`}
                  className="text-accent hover:underline"
                >
                  {req.itemEstoque.nome}
                </Link>
              </dd>
            </div>
          )}
        </div>

        {req.justificativa && (
          <div>
            <dt className="text-xs font-semibold text-subtle uppercase">
              Justificativa
            </dt>
            <dd className="text-sm text-fg mt-1">{req.justificativa}</dd>
          </div>
        )}

        {req.observacao && (
          <div>
            <dt className="text-xs font-semibold text-subtle uppercase">
              Observação
            </dt>
            <dd className="text-sm text-fg mt-1">{req.observacao}</dd>
          </div>
        )}
      </div>

      {podeGerenciar && req.status === "SOLICITADA" && (
        <div className="bg-surface rounded-xl border border-border p-6 space-y-4">
          <h3 className="font-semibold text-fg">Aprovar ou Rejeitar</h3>
          <div className="flex items-center gap-3">
            <form method="POST" className="inline">
              <input type="hidden" name="intent" value="aprovar" />
              <textarea
                name="observacao"
                rows={2}
                className="hidden"
                defaultValue="Aprovado"
              />
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-md bg-success px-6 h-11 text-sm font-medium text-white hover:bg-success transition-colors"
              >
                Aprovar
              </button>
            </form>
            <form method="POST" className="inline-flex items-start gap-2">
              <input type="hidden" name="intent" value="rejeitar" />
              <textarea
                name="observacao"
                rows={2}
                className="w-64 rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                placeholder="Motivo da rejeição (mín. 5 caracteres)"
                required
                minLength={5}
              />
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-md bg-danger px-6 h-11 text-sm font-medium text-white hover:bg-danger transition-colors shrink-0"
              >
                Rejeitar
              </button>
            </form>
          </div>
        </div>
      )}

      {podeGerenciar && req.status === "APROVADA" && (
        <div className="bg-surface rounded-xl border border-border p-6 space-y-4">
          <h3 className="font-semibold text-fg">Registrar Compra</h3>
          <p className="text-sm text-muted">
            Informe o valor pago. Ao registrar a compra, o estoque do item
            vinculado será atualizado automaticamente.
          </p>
          <form method="POST" className="space-y-3">
            <input type="hidden" name="intent" value="comprar" />
            <div className="space-y-1">
              <label
                htmlFor="valorDisplay"
                className="block text-sm font-medium text-fg"
              >
                Valor da Compra (R$) <span className="text-danger">*</span>
              </label>
              <input
                id="valorDisplay"
                name="valorDisplay"
                type="text"
                className="w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                placeholder="0,00"
                required
              />
            </div>
            {caixas.length > 0 && (
              <div className="space-y-1">
                <label
                  htmlFor="caixaId"
                  className="block text-sm font-medium text-fg"
                >
                  Caixa de Destino (opcional)
                </label>
                <select
                  id="caixaId"
                  name="caixaId"
                  className="w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <option value="">Sem integração financeira</option>
                  {caixas.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="space-y-1">
              <label
                htmlFor="compraObservacao"
                className="block text-sm font-medium text-fg"
              >
                Observação (opcional)
              </label>
              <textarea
                id="compraObservacao"
                name="observacao"
                rows={2}
                className="w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                placeholder="Ex: Comprado no mercado X, NF 12345."
              />
            </div>
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-md bg-accent px-6 h-11 text-sm font-medium text-white hover:bg-accent-strong transition-colors"
            >
              Registrar Compra
            </button>
          </form>
        </div>
      )}

      {req.status === "COMPRADA" && (
        <div className="bg-success-soft border border-success-soft rounded-xl p-6 text-center">
          <p className="text-sm font-semibold text-success">
            Esta requisição foi comprada e o estoque foi atualizado.
          </p>
        </div>
      )}

      {req.status === "REJEITADA" && (
        <div className="bg-danger-soft border border-danger-soft rounded-xl p-6 text-center">
          <p className="text-sm font-semibold text-danger">
            Esta requisição foi rejeitada.
          </p>
        </div>
      )}
    </main>
  );
}
