import { useState } from "react";
import type { Route } from "./+types/estoque.$id._index";
import { Link, Form, useNavigation, redirect } from "react-router";
import { userContext } from "~/lib/user-context";
import { assertCanSeeEstoque, assertCanManageEstoque } from "~/lib/rbac.server";
import { getItemEstoqueDetalhe, arquivarItem, reabrirItem } from "~/lib/itemEstoque.server";
import BadgeTipoItem from "~/components/BadgeTipoItem";
import BadgeStatusPatrimonio from "~/components/BadgeStatusPatrimonio";
import TabelaMovimentacoes from "~/components/TabelaMovimentacoes";
import CardMovimentacao from "~/components/CardMovimentacao";
import TabelaManutencoes from "~/components/TabelaManutencoes";
import CardManutencao from "~/components/CardManutencao";

export function meta({ data }: Route.MetaArgs) {
  return [{ title: `${data?.item?.nome || "Detalhe"} · Estoque · Igreja Conect` }];
}

export async function loader({ request, context, params }: Route.LoaderArgs) {
  const user = context.get(userContext);
  if (!user) throw new Response("Não autenticado.", { status: 401 });
  assertCanSeeEstoque(user);

  const item = await getItemEstoqueDetalhe(params.id, user);
  if (!item) throw new Response("Item não encontrado.", { status: 404 });

  const podeGerenciar = !!(user.cargo && ["ADMIN", "PASTOR", "SECRETARIO"].includes(user.cargo));
  const isAdmin = user.cargo === "ADMIN";

  return { item, user, podeGerenciar, isAdmin };
}

export async function action({ request, context, params }: Route.ActionArgs) {
  const user = context.get(userContext);
  if (!user) throw new Response("Não autenticado.", { status: 401 });
  assertCanManageEstoque(user);

  const formData = await request.formData();
  const _op = formData.get("_op");

  if (_op === "arquivar") {
    await arquivarItem(params.id, user);
    return redirect("/app/estoque");
  }
  if (_op === "reabrir") {
    await reabrirItem(params.id, user);
    return redirect("/app/estoque");
  }

  throw new Response("Operação inválida.", { status: 400 });
}

export default function DetalheItem({ loaderData }: Route.ComponentProps) {
  const { item, podeGerenciar, isAdmin } = loaderData;
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const tabs = item.tipo === "PATRIMONIO"
    ? ["Movimentações", "Manutenções"] as const
    : ["Movimentações"] as const;
  const [tabAtivo, setTabAtivo] = useState<string>(tabs[0]);

  const podeMovimentar = podeGerenciar && item.tipo === "CONSUMO";
  const podeEnviarManutencao = podeGerenciar && item.tipo === "PATRIMONIO" && item.statusPatrimonio === "DISPONIVEL";
  const podeRegistrarRetorno = podeGerenciar && item.tipo === "PATRIMONIO" && item.statusPatrimonio === "EM_MANUTENCAO";
  const podeBaixarPerda = isAdmin && item.tipo === "PATRIMONIO";

  return (
    <main className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto w-full space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-xs font-semibold text-slate-400">
        <Link to="/app/estoque" className="hover:text-blue-600 transition-colors">Estoque</Link>
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
        <span className="text-blue-600">{item.nome}</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div>
            <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">{item.nome}</h2>
            <div className="flex items-center gap-3 mt-2">
              <BadgeTipoItem tipo={item.tipo} />
              <BadgeStatusPatrimonio status={item.statusPatrimonio} />
              {item.ativo ? (
                <span className="inline-flex items-center gap-1.5 text-xs text-emerald-600">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Ativo
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-xs text-slate-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span> Arquivado
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {podeMovimentar && (
            <Link to={`/app/estoque/${item.id}/movimentar`}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 shadow-lg shadow-blue-500/30 transition-all">
              Movimentar
            </Link>
          )}
          {podeEnviarManutencao && (
            <Link to={`/app/estoque/${item.id}/manutencao`}
              className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-bold hover:bg-amber-700 shadow-lg shadow-amber-500/30 transition-all">
              Enviar para manutenção
            </Link>
          )}
          {podeRegistrarRetorno && (
            <Link to={`/app/estoque/${item.id}/retorno`}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold hover:bg-emerald-700 shadow-lg shadow-emerald-500/30 transition-all">
              Registrar retorno
            </Link>
          )}
          {podeBaixarPerda && (
            <Link to={`/app/estoque/${item.id}/baixa`}
              className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-bold hover:bg-red-700 shadow-lg shadow-red-500/30 transition-all">
              Baixar por perda
            </Link>
          )}
          {podeGerenciar && (
            item.ativo ? (
              <Form method="post">
                <input type="hidden" name="_op" value="arquivar" />
                <button type="submit" disabled={isSubmitting}
                  className="px-4 py-2 border border-slate-200 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-50 transition-colors">
                  Arquivar
                </button>
              </Form>
            ) : (
              <Form method="post">
                <input type="hidden" name="_op" value="reabrir" />
                <button type="submit" disabled={isSubmitting}
                  className="px-4 py-2 border border-emerald-200 text-emerald-600 rounded-lg text-sm font-semibold hover:bg-emerald-50 transition-colors">
                  Reabrir
                </button>
              </Form>
            )
          )}
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Quantidade</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{item.quantidade}</p>
        </div>
        {item.tipo === "CONSUMO" && (
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Qtd Mínima</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{item.quantidadeMinima}</p>
          </div>
        )}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Localização</p>
          <p className="text-lg font-bold text-slate-900 mt-1">{item.localizacaoFisica || "—"}</p>
        </div>
        {item.numeroSerie && (
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Nº Série</p>
            <p className="text-lg font-bold text-slate-900 mt-1 font-mono">{item.numeroSerie}</p>
          </div>
        )}
        {item.estoqueBaixo && (
          <div className="bg-white p-4 rounded-xl border border-red-200 shadow-sm bg-red-50">
            <p className="text-xs font-bold text-red-500 uppercase tracking-wider">Alerta</p>
            <p className="text-sm font-bold text-red-700 mt-1">Estoque baixo!</p>
          </div>
        )}
      </div>

      <p className="text-sm text-slate-600">{item.descricao || "Sem descrição cadastrada."}</p>

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <nav className="flex gap-6">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setTabAtivo(tab)}
              className={`pb-3 text-sm font-bold border-b-2 transition-colors ${
                tabAtivo === tab
                  ? "text-blue-600 border-blue-600"
                  : "text-slate-400 border-transparent hover:text-slate-600"
              }`}
            >
              {tab === "Manutenções" ? (
                <>
                  Manutenções
                  {item.manutencoes.length > 0 && (
                    <span className="ml-2 text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
                      {item.manutencoes.length}
                    </span>
                  )}
                </>
              ) : (
                <>
                  Movimentações
                  {item.movimentacoes.length > 0 && (
                    <span className="ml-2 text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
                      {item.movimentacoes.length}
                    </span>
                  )}
                </>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <section className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        {tabAtivo === "Movimentações" && (
          <>
            <div className="hidden md:block">
              <TabelaMovimentacoes movimentacoes={item.movimentacoes} />
            </div>
            <div className="md:hidden">
              <CardMovimentacao movimentacoes={item.movimentacoes} />
            </div>
          </>
        )}
        {tabAtivo === "Manutenções" && (
          <>
            <div className="hidden md:block">
              <TabelaManutencoes manutencoes={item.manutencoes} />
            </div>
            <div className="md:hidden">
              <CardManutencao manutencoes={item.manutencoes} />
            </div>
          </>
        )}
      </section>
    </main>
  );
}
