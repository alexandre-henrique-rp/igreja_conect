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
      <nav className="flex items-center gap-2 text-xs font-semibold text-subtle mb-2">
        <Link to="/app/estoque" className="hover:text-accent transition-colors">Estoque</Link>
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
        <Link to={`/app/estoque/${item.id}`} className="hover:text-accent transition-colors">{item.nome}</Link>
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
        <span className="text-accent">Retorno</span>
      </nav>

      <h2 className="text-3xl font-extrabold text-fg tracking-tight">Retorno de Manutenção</h2>
      <p className="text-muted text-sm">
        {item.nome} &mdash; enviado para {manutencao.assistenciaTecnica}
      </p>

      <div className="bg-surface border border-border rounded-2xl shadow-sm overflow-hidden">
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-semibold text-fg">Assistência:</span>
              <p className="text-muted">{manutencao.assistenciaTecnica}</p>
            </div>
            <div>
              <span className="font-semibold text-fg">Data Envio:</span>
              <p className="text-muted">{new Date(manutencao.dataEnvio).toLocaleDateString("pt-BR")}</p>
            </div>
          </div>

          <div className="bg-warning-soft border border-warning-soft rounded-xl p-4 text-sm text-warning">
            Confirma o retorno deste item da manutenção? O status será alterado para <strong>Disponível</strong>.
          </div>
        </div>

        <Form method="post" className="p-6 bg-surface-2 border-t border-surface-2 flex items-center justify-end gap-3">
          <input type="hidden" name="manutencaoId" value={manutencao.id} />
          <Link
            to={`/app/estoque/${item.id}`}
            className="px-6 py-2.5 text-sm font-semibold text-muted hover:text-fg transition-colors"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            className="px-8 py-2.5 bg-success text-white rounded-xl font-bold text-sm hover:bg-success shadow-lg shadow-success/30 transition-all transform active:scale-95"
          >
            Confirmar Retorno
          </button>
        </Form>
      </div>
    </main>
  );
}
