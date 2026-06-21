import type { Route } from "./+types/estoque.$id.retorno";
import { Form, Link, redirect } from "react-router";
import { userContext } from "~/lib/user-context";
import { prisma } from "~/db/prisma.server";
import { assertCanSendToMaintenance } from "~/lib/rbac.server";
import { getItemEstoqueDetalhe } from "~/lib/itemEstoque.server";
import { retornarDeManutencao } from "~/lib/manutencao.server";

export function meta() {
  return [{ title: "Retorno de Manutenção · Estoque · Igreja Conect" }];
}

export async function loader({ params, context }: Route.LoaderArgs) {
  const user = context.get(userContext);
  if (!user) throw new Response("Não autenticado.", { status: 401 });
  assertCanSendToMaintenance(user);

  const item = await getItemEstoqueDetalhe(params.id, user);
  if (!item) throw new Response("Item não encontrado.", { status: 404 });

  const manutencao = await prisma.manutencaoAtivo.findFirst({
    where: { itemEstoqueId: params.id, dataRetorno: null },
  });
  if (!manutencao) {
    return redirect(`/app/estoque/${params.id}`);
  }

  return { manutencao, item };
}

export async function action({ params, request, context }: Route.ActionArgs) {
  const user = context.get(userContext);
  if (!user) throw new Response("Não autenticado.", { status: 401 });
  assertCanSendToMaintenance(user);

  const formData = await request.formData();
  const manutencaoId = formData.get("manutencaoId") as string;

  try {
    await retornarDeManutencao(manutencaoId, user);
    return redirect(`/app/estoque/${params.id}?toast=retorno-manutencao`);
  } catch (err: any) {
    if (err instanceof Response) throw err;
    return { success: false, error: err.message };
  }
}

export default function RetornoManutencao({ loaderData }: Route.ComponentProps) {
  const { manutencao, item } = loaderData;

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
        <span className="text-blue-600">Retorno</span>
      </nav>

      <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Retorno de Manutenção</h2>
      <p className="text-slate-500 text-sm">
        {item.nome} &mdash; enviado para {manutencao.assistenciaTecnica}
      </p>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-semibold text-slate-700">Assistência:</span>
              <p className="text-slate-600">{manutencao.assistenciaTecnica}</p>
            </div>
            <div>
              <span className="font-semibold text-slate-700">Data Envio:</span>
              <p className="text-slate-600">{new Date(manutencao.dataEnvio).toLocaleDateString("pt-BR")}</p>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
            Confirma o retorno deste item da manutenção? O status será alterado para <strong>Disponível</strong>.
          </div>
        </div>

        <Form method="post" className="p-6 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
          <input type="hidden" name="manutencaoId" value={manutencao.id} />
          <Link
            to={`/app/estoque/${item.id}`}
            className="px-6 py-2.5 text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            className="px-8 py-2.5 bg-green-600 text-white rounded-xl font-bold text-sm hover:bg-green-700 shadow-lg shadow-green-500/30 transition-all transform active:scale-95"
          >
            Confirmar Retorno
          </button>
        </Form>
      </div>
    </main>
  );
}
