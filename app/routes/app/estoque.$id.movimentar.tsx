import type { Route } from "./+types/estoque.$id.movimentar";
import { Form, Link, useActionData, useNavigation, redirect } from "react-router";
import { userContext } from "~/lib/user-context";
import { assertCanMovimentarConsumo } from "~/lib/rbac.server";
import { getItemEstoqueDetalhe } from "~/lib/itemEstoque.server";
import { criarMovimentacao } from "~/lib/movimentacao.server";
import { MovimentacaoCreateSchema } from "~/lib/schemas/estoque";

export function meta() {
  return [{ title: "Movimentar · Estoque · Igreja Conect" }];
}

export async function loader({ params, context }: Route.LoaderArgs) {
  const user = context.get(userContext);
  if (!user) throw new Response("Não autenticado.", { status: 401 });
  assertCanMovimentarConsumo(user);

  const item = await getItemEstoqueDetalhe(params.id, user);
  if (!item || item.tipo !== "CONSUMO") {
    throw new Response("Item não encontrado ou não é de consumo.", { status: 404 });
  }

  return { item };
}

export async function action({ params, request, context }: Route.ActionArgs) {
  const user = context.get(userContext);
  if (!user) throw new Response("Não autenticado.", { status: 401 });
  assertCanMovimentarConsumo(user);

  const formData = await request.formData();
  const raw = Object.fromEntries(formData) as Record<string, string>;

  const parsed = MovimentacaoCreateSchema.safeParse({
    quantidade: raw.quantidade !== "" ? Number(raw.quantidade) : undefined,
    nomeRetirante: raw.nomeRetirante || undefined,
    justificativa: raw.justificativa || undefined,
  });
  if (!parsed.success) {
    return {
      success: false,
      fieldErrors: parsed.error.flatten().fieldErrors,
      error: "Dados inválidos. Verifique os campos.",
      values: raw,
    };
  }

  try {
    await criarMovimentacao({ ...parsed.data, itemId: params.id }, user);
    return redirect(`/app/estoque/${params.id}?toast=movimentacao-registrada`);
  } catch (err: any) {
    if (err instanceof Response) throw err;
    return { success: false, error: err.message, values: raw };
  }
}

export default function MovimentarItem({ loaderData, actionData }: Route.ComponentProps) {
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const { item } = loaderData;

  return (
    <main className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto w-full space-y-6">
      <nav className="flex items-center gap-2 text-xs font-semibold text-slate-400 mb-2">
        <Link to="/app/estoque" className="hover:text-blue-600 transition-colors">Estoque</Link>
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
        <Link to={`/app/estoque/${item.id}`} className="hover:text-blue-600 transition-colors">{item.nome}</Link>
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
        <span className="text-blue-600">Movimentar</span>
      </nav>

      <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Movimentar Estoque</h2>
      <p className="text-slate-500 text-sm">
        {item.nome} &mdash; Saldo atual: <strong>{item.quantidade}</strong> unidade(s)
      </p>

      {actionData?.error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          {actionData.error}
        </div>
      )}

      <Form method="post" className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-8 space-y-8">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Quantidade *</label>
            <input
              name="quantidade"
              type="number"
              required
              className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm"
              placeholder="Ex: -3 para saída, 10 para entrada"
            />
            <p className="text-xs text-slate-400 mt-1">Use negativo para saída, positivo para entrada.</p>
            {actionData?.fieldErrors?.quantidade && (
              <p className="text-xs text-red-500 mt-1">{actionData.fieldErrors.quantidade}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Nome do Retirante</label>
            <input
              name="nomeRetirante"
              type="text"
              className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm"
              placeholder="Obrigatório para saída"
            />
            {actionData?.fieldErrors?.nomeRetirante && (
              <p className="text-xs text-red-500 mt-1">{actionData.fieldErrors.nomeRetirante}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Justificativa</label>
            <textarea
              name="justificativa"
              className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all resize-none text-sm"
              rows={3}
            />
          </div>
        </div>

        <div className="p-6 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
          <Link
            to={`/app/estoque/${item.id}`}
            className="px-6 py-2.5 text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-8 py-2.5 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 shadow-lg shadow-blue-500/30 transition-all transform active:scale-95 disabled:opacity-50"
          >
            {isSubmitting ? "Registrando..." : "Registrar Movimentação"}
          </button>
        </div>
      </Form>
    </main>
  );
}
