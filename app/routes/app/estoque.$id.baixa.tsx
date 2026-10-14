import type { Route } from "./+types/estoque.$id.baixa";
import { Form, Link, useActionData, useNavigation, redirect } from "react-router";
import { userContext } from "~/lib/user-context";
import { assertCanBaixarPerda } from "~/lib/rbac.server";
import { getItemEstoqueDetalhe } from "~/lib/itemEstoque.server";
import { baixaPorPerda } from "~/lib/manutencao.server";
import { BaixaPerdaSchema } from "~/lib/schemas/estoque";

export function meta() {
  return [{ title: "Baixa por Perda · Estoque · Igreja Conect" }];
}

export async function loader({ params, context }: Route.LoaderArgs) {
  const user = context.get(userContext);
  if (!user) throw new Response("Não autenticado.", { status: 401 });
  assertCanBaixarPerda(user);

  const item = await getItemEstoqueDetalhe(params.id, user);
  if (!item) throw new Response("Item não encontrado.", { status: 404 });

  return { item };
}

export async function action({ params, request, context }: Route.ActionArgs) {
  const user = context.get(userContext);
  if (!user) throw new Response("Não autenticado.", { status: 401 });
  assertCanBaixarPerda(user);

  const formData = await request.formData();
  const raw = Object.fromEntries(formData) as Record<string, string>;

  const parsed = BaixaPerdaSchema.safeParse({ motivo: raw.motivo });
  if (!parsed.success) {
    return {
      success: false,
      fieldErrors: parsed.error.flatten().fieldErrors,
      error: "Dados inválidos. Verifique os campos.",
      values: raw,
    };
  }

  try {
    await baixaPorPerda(params.id, parsed.data, user);
    return redirect("/app/estoque?toast=item-baixado");
  } catch (err: any) {
    if (err instanceof Response) throw err;
    return { success: false, error: err.message, values: raw };
  }
}

export default function BaixaPerda({ loaderData, actionData }: Route.ComponentProps) {
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const { item } = loaderData;

  return (
    <main className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto w-full space-y-6">
      <nav className="flex items-center gap-2 text-xs font-semibold text-subtle mb-2">
        <Link to="/app/estoque" className="hover:text-accent transition-colors">Estoque</Link>
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
        <Link to={`/app/estoque/${item.id}`} className="hover:text-accent transition-colors">{item.nome}</Link>
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
        <span className="text-accent">Baixa por Perda</span>
      </nav>

      <h2 className="text-3xl font-extrabold text-fg tracking-tight">Baixa por Perda</h2>
      <p className="text-muted text-sm">
        {item.nome} &mdash; {item.numeroSerie || "sem nº série"}
      </p>

      <div className="bg-danger-soft border border-danger-soft rounded-xl p-4 text-sm text-danger">
        Esta ação é <strong>irreversível</strong>. O item será marcado como <strong>BAIXADO_PERDA</strong> e
        desativado no sistema. Apenas ADMIN pode realizar esta operação.
      </div>

      {actionData?.error && (
        <div className="p-4 bg-danger-soft border border-danger-soft rounded-xl text-sm text-danger">
          {actionData.error}
        </div>
      )}

      <Form method="post" className="bg-surface border border-border rounded-2xl shadow-sm overflow-hidden">
        <div className="p-8">
          <label className="block text-sm font-semibold text-fg mb-2">Motivo da Perda *</label>
          <textarea
            name="motivo"
            required
            rows={4}
            defaultValue={actionData?.values?.motivo as string}
            className="w-full p-3 border border-border rounded-xl bg-surface-2 focus:ring-2 focus:ring-accent/20 focus:border-accent outline-none transition-all resize-none text-sm"
            placeholder="Descreva o motivo da perda (mín. 10 caracteres)..."
          />
          {actionData?.fieldErrors?.motivo && (
            <p className="text-xs text-danger mt-1">{actionData.fieldErrors.motivo}</p>
          )}
        </div>

        <div className="p-6 bg-surface-2 border-t border-surface-2 flex items-center justify-end gap-3">
          <Link
            to={`/app/estoque/${item.id}`}
            className="px-6 py-2.5 text-sm font-semibold text-muted hover:text-fg transition-colors"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-8 py-2.5 bg-danger text-white rounded-xl font-bold text-sm hover:bg-danger shadow-lg shadow-danger/30 transition-all transform active:scale-95 disabled:opacity-50"
          >
            {isSubmitting ? "Baixando..." : "Confirmar Baixa por Perda"}
          </button>
        </div>
      </Form>
    </main>
  );
}
