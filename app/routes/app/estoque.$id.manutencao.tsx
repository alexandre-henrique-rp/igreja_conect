import type { Route } from "./+types/estoque.$id.manutencao";
import { Form, Link, useActionData, useNavigation, redirect } from "react-router";
import { userContext } from "~/lib/user-context";
import { assertCanSendToMaintenance } from "~/lib/rbac.server";
import { getItemEstoqueDetalhe } from "~/lib/itemEstoque.server";
import { enviarParaManutencao } from "~/lib/manutencao.server";
import { ManutencaoCreateSchema } from "~/lib/schemas/estoque";

export function meta() {
  return [{ title: "Enviar para Manutenção · Estoque · Igreja Conect" }];
}

export async function loader({ params, context }: Route.LoaderArgs) {
  const user = context.get(userContext);
  if (!user) throw new Response("Não autenticado.", { status: 401 });
  assertCanSendToMaintenance(user);

  const item = await getItemEstoqueDetalhe(params.id, user);
  if (!item || item.tipo !== "PATRIMONIO") {
    throw new Response("Item não encontrado ou não é patrimônio.", { status: 404 });
  }

  return { item };
}

export async function action({ params, request, context }: Route.ActionArgs) {
  const user = context.get(userContext);
  if (!user) throw new Response("Não autenticado.", { status: 401 });
  assertCanSendToMaintenance(user);

  const formData = await request.formData();
  const raw = Object.fromEntries(formData) as Record<string, string>;

  const parsed = ManutencaoCreateSchema.safeParse({
    assistenciaTecnica: raw.assistenciaTecnica,
    enderecoAssistencia: raw.enderecoAssistencia,
    numeroOs: raw.numeroOs || undefined,
    prazoTermino: raw.prazoTermino || undefined,
    custoCentavos: raw.custoCentavos !== "" ? Number(raw.custoCentavos) : undefined,
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
    await enviarParaManutencao({ ...parsed.data, itemId: params.id }, user);
    return redirect(`/app/estoque/${params.id}?toast=enviado-manutencao`);
  } catch (err: any) {
    if (err instanceof Response) throw err;
    return { success: false, error: err.message, values: raw };
  }
}

export default function EnviarManutencao({ loaderData, actionData }: Route.ComponentProps) {
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
        <span className="text-blue-600">Manutenção</span>
      </nav>

      <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Enviar para Manutenção</h2>
      <p className="text-slate-500 text-sm">{item.nome} &mdash; {item.numeroSerie}</p>

      {actionData?.error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          {actionData.error}
        </div>
      )}

      <Form method="post" className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-8 space-y-8">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Assistência Técnica *</label>
            <input
              name="assistenciaTecnica"
              type="text"
              required
              defaultValue={actionData?.values?.assistenciaTecnica as string}
              className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm"
              placeholder="Ex: Tech Assist Ltda"
            />
            {actionData?.fieldErrors?.assistenciaTecnica && (
              <p className="text-xs text-red-500 mt-1">{actionData.fieldErrors.assistenciaTecnica}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Endereço da Assistência *</label>
            <input
              name="enderecoAssistencia"
              type="text"
              required
              defaultValue={actionData?.values?.enderecoAssistencia as string}
              className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm"
              placeholder="Ex: Rua X, 123 — Bairro Y"
            />
            {actionData?.fieldErrors?.enderecoAssistencia && (
              <p className="text-xs text-red-500 mt-1">{actionData.fieldErrors.enderecoAssistencia}</p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Nº OS</label>
              <input
                name="numeroOs"
                type="text"
                defaultValue={actionData?.values?.numeroOs as string}
                className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Prazo Término</label>
              <input
                name="prazoTermino"
                type="date"
                defaultValue={actionData?.values?.prazoTermino as string}
                className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Custo (centavos)</label>
            <input
              name="custoCentavos"
              type="number"
              min="0"
              defaultValue={actionData?.values?.custoCentavos as string}
              className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm"
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
            {isSubmitting ? "Enviando..." : "Enviar para Manutenção"}
          </button>
        </div>
      </Form>
    </main>
  );
}
