import type { Route } from "./+types/estoque.requisicoes.nova";
import { Link, redirect, useActionData } from "react-router";
import { ZodError } from "zod";
import { userContext } from "~/lib/user-context";
import { assertCanSeeEstoque } from "~/lib/rbac.server";
import { criarRequisicao } from "~/lib/requisicaoCompra.server";
import { RequisicaoCompraCreateSchema } from "~/lib/schemas/requisicaoCompra";
import { prisma } from "~/db/prisma.server";

export function meta() {
  return [{ title: "Nova Requisição de Compra · Igreja Conect" }];
}

export async function loader({ context }: Route.LoaderArgs) {
  const user = context.get(userContext);
  if (!user) throw new Response("Não autenticado.", { status: 401 });
  assertCanSeeEstoque(user);

  const itens = await prisma.itemEstoque.findMany({
    where: { ativo: true },
    select: { id: true, nome: true, tipo: true },
    orderBy: { nome: "asc" },
  });

  return { itens };
}

function zodErrorsToMap(errors: ZodError["issues"]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const issue of errors) {
    const path = issue.path.join(".");
    if (path && !map[path]) {
      map[path] = issue.message;
    }
  }
  return map;
}

export async function action({ request, context }: Route.ActionArgs) {
  const user = context.get(userContext);
  if (!user) throw new Response("Não autenticado.", { status: 401 });
  assertCanSeeEstoque(user);

  const formData = await request.formData();
  const raw: Record<string, string> = {};
  for (const [k, v] of formData) {
    if (typeof v === "string") raw[k] = v;
  }

  const payload = {
    itemEstoqueId: raw.itemEstoqueId || null,
    nomeItem: raw.nomeItem,
    quantidade: raw.quantidade,
    justificativa: raw.justificativa,
  };

  const result = RequisicaoCompraCreateSchema.safeParse(payload);
  if (!result.success) {
    return { fieldErrors: zodErrorsToMap(result.error.issues), defaultValues: raw };
  }

  try {
    const req = await criarRequisicao(result.data, user);
    return redirect(`/app/estoque/requisicoes/${req.id}`);
  } catch (err: unknown) {
    if (err instanceof Response) throw err;
    if (err instanceof ZodError) {
      return { fieldErrors: zodErrorsToMap(err.issues), defaultValues: raw };
    }
    throw err;
  }
}

export default function NovaRequisicao({ loaderData, actionData }: Route.ComponentProps) {
  const { itens } = loaderData;
  const fieldErrors: Record<string, string> =
    (actionData as { fieldErrors?: Record<string, string> } | undefined)?.fieldErrors ?? {};
  const defaultValues: Record<string, string> =
    (actionData as { defaultValues?: Record<string, string> } | undefined)?.defaultValues ?? {};

  return (
    <main className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto w-full space-y-6 bg-slate-50 min-h-screen">
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
            <span className="text-blue-600">Nova</span>
          </nav>
          <h2 className="text-2xl font-bold text-slate-900">Nova Requisição de Compra</h2>
        </div>
        <Link
          to="/app/estoque/requisicoes"
          className="px-4 h-10 flex items-center border border-slate-200 text-slate-600 bg-white rounded-lg font-semibold hover:bg-slate-50 transition-all text-sm"
        >
          Cancelar
        </Link>
      </div>

      <form method="POST" className="space-y-5 bg-white rounded-xl border border-slate-200 p-6">
        <div className="space-y-1">
          <label htmlFor="itemEstoqueId" className="block text-sm font-medium text-slate-700">
            Item do Estoque (opcional)
          </label>
          <select
            id="itemEstoqueId"
            name="itemEstoqueId"
            defaultValue={defaultValues.itemEstoqueId ?? ""}
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <option value="">— Item novo (não cadastrado) —</option>
            {itens.map((item) => (
              <option key={item.id} value={item.id}>
                {item.nome} ({item.tipo === "CONSUMO" ? "Consumo" : "Patrimônio"})
              </option>
            ))}
          </select>
          <p className="text-xs text-slate-400">
            Selecione um item existente ou deixe em branco para solicitar um item novo.
          </p>
        </div>

        <div className="space-y-1">
          <label htmlFor="nomeItem" className="block text-sm font-medium text-slate-700">
            Nome do Item <span className="text-red-600">*</span>
          </label>
          <input
            id="nomeItem"
            name="nomeItem"
            type="text"
            defaultValue={defaultValues.nomeItem ?? ""}
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            placeholder="Ex: Café em Grãos (1kg)"
            required
          />
          {fieldErrors.nomeItem && (
            <p role="alert" className="text-sm text-red-600">{fieldErrors.nomeItem}</p>
          )}
        </div>

        <div className="space-y-1">
          <label htmlFor="quantidade" className="block text-sm font-medium text-slate-700">
            Quantidade <span className="text-red-600">*</span>
          </label>
          <input
            id="quantidade"
            name="quantidade"
            type="number"
            min="1"
            defaultValue={defaultValues.quantidade ?? ""}
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            placeholder="Ex: 10"
            required
          />
          {fieldErrors.quantidade && (
            <p role="alert" className="text-sm text-red-600">{fieldErrors.quantidade}</p>
          )}
        </div>

        <div className="space-y-1">
          <label htmlFor="justificativa" className="block text-sm font-medium text-slate-700">
            Justificativa <span className="text-red-600">*</span>
          </label>
          <textarea
            id="justificativa"
            name="justificativa"
            rows={3}
            defaultValue={defaultValues.justificativa ?? ""}
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            placeholder="Ex: Estoque abaixo do mínimo, necessário para o culto de domingo..."
            required
          />
          {fieldErrors.justificativa && (
            <p role="alert" className="text-sm text-red-600">{fieldErrors.justificativa}</p>
          )}
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            className="inline-flex items-center justify-center rounded-md bg-blue-600 px-6 h-11 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            Criar Requisição
          </button>
          <Link
            to="/app/estoque/requisicoes"
            className="inline-flex items-center justify-center rounded-md border border-slate-200 px-6 h-11 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Cancelar
          </Link>
        </div>
      </form>
    </main>
  );
}
