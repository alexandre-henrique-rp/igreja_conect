/**
 * Rota /app/escalas — Gestão de Escalas de Voluntários por Ministério.
 */
import { useState, useMemo } from "react";
import { Link, Form, useFetcher } from "react-router";
import type { Route } from "./+types/escalas._index";
import { userContext } from "~/lib/user-context";
import { listarEscalas, adicionarVoluntario, removerVoluntario, atualizarStatus } from "~/lib/escalas.server";
import { gerarEscalasTodosMinisterios } from "~/lib/gerarEscalas.server";
import type { EscalaComVoluntarios } from "~/lib/escalas.server";
import { prisma } from "~/db/prisma.server";
import { Button } from "~/components/Button";

function formatDate(d: Date): string {
  const dia = String(d.getDate()).padStart(2, "0");
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  return `${dia}/${mes}`;
}

const MINISTERIO_ICONS: Record<string, string> = {
  LOUVOR: "🎵",
  RECEPCAO: "🤝",
  "SOM & MIDIA": "🎙",
  KIDS: "👦",
  ESTACIONAMENTO: "🚗",
};

function getIcon(nome: string): string {
  const key = nome.toUpperCase().replace(/[&]/g, "E").replace(/\s+/g, "_");
  return MINISTERIO_ICONS[key] ?? "📋";
}

const CAN_GERAR_TODOS = ["ADMIN", "PASTOR", "SECRETARIO"] as const;
const CAN_EDIT = ["ADMIN", "PASTOR", "SECRETARIO", "LIDER_MINISTERIO"] as const;

export function meta(_args: Route.MetaArgs) {
  return [{ title: "Escalas · Igreja Conect" }];
}

export async function loader({ context }: Route.LoaderArgs) {
  const user = context.get(userContext);
  if (!user) throw new Response("Não autenticado.", { status: 401 });
  const escalas = await listarEscalas(user);

  const canGerarTodos =
    user.cargo != null && (CAN_GERAR_TODOS as readonly string[]).includes(user.cargo);
  const canEdit =
    user.cargo != null && (CAN_EDIT as readonly string[]).includes(user.cargo);

  const membros = canEdit
    ? await prisma.membro.findMany({
        select: { id: true, nome: true },
        orderBy: { nome: "asc" },
        take: 200,
      })
    : [];

  return { user, escalas, canGerarTodos, canEdit, membros };
}

export async function action({ context, request }: Route.ActionArgs) {
  const user = context.get(userContext);
  if (!user) throw new Response("Não autenticado.", { status: 401 });

  const canEdit =
    user.cargo != null && (CAN_EDIT as readonly string[]).includes(user.cargo);
  if (!canEdit) throw new Response("Sem permissão.", { status: 403 });

  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "");

  if (intent === "gerar-todos-ministerios") {
    const canGerarTodos =
      user.cargo != null && (CAN_GERAR_TODOS as readonly string[]).includes(user.cargo);
    if (!canGerarTodos) throw new Response("Sem permissão para gerar todas as escalas.", { status: 403 });

    const agora = new Date();
    const mes = agora.getMonth() + 1;
    const ano = agora.getFullYear();
    const result = await gerarEscalasTodosMinisterios(mes, ano, user);
    return new Response(
      JSON.stringify({ ok: true, resumo: result.resumo, totalEscalas: result.totalEscalas }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }

  if (intent === "add-voluntario") {
    const escalaId = String(formData.get("escalaId") ?? "");
    const membroId = String(formData.get("membroId") ?? "");
    const funcao = String(formData.get("funcao") ?? "");
    if (!escalaId || !membroId || !funcao) throw new Response("Campos obrigatórios.", { status: 400 });
    await adicionarVoluntario(escalaId, { membroId, funcao }, user);
    return new Response(null, { status: 302, headers: { Location: "/app/escalas" } });
  }

  if (intent === "remove-voluntario") {
    const voluntarioId = String(formData.get("voluntarioId") ?? "");
    if (!voluntarioId) throw new Response("voluntarioId obrigatório.", { status: 400 });
    await removerVoluntario(voluntarioId, user);
    return new Response(null, { status: 302, headers: { Location: "/app/escalas" } });
  }

  if (intent === "atualizar-status") {
    const escalaId = String(formData.get("escalaId") ?? "");
    const status = String(formData.get("status") ?? "");
    if (!escalaId || !status) throw new Response("Campos obrigatórios.", { status: 400 });
    await atualizarStatus(
      escalaId,
      status as "PENDENTE" | "CONFIRMADA" | "REALIZADA" | "CANCELADA",
      user,
    );
    return new Response(null, { status: 302, headers: { Location: "/app/escalas" } });
  }

  throw new Response("Intent não reconhecido.", { status: 400 });
}

export default function EscalasIndex({ loaderData }: Route.ComponentProps) {
  const { escalas, canGerarTodos, canEdit, membros } = loaderData;
  const fetcher = useFetcher();

  const [escalaEditando, setEscalaEditando] = useState<string | null>(null);
  const [novoVoluntario, setNovoVoluntario] = useState({ membroId: "", funcao: "" });

  const grupos = useMemo(() => {
    const map = new Map<string, EscalaComVoluntarios[]>();
    for (const e of escalas) {
      const existing = map.get(e.ministerioNome) ?? [];
      existing.push(e);
      map.set(e.ministerioNome, existing);
    }
    return Array.from(map.entries()).map(([nome, items]) => ({
      nome,
      items,
      totalVoluntarios: items.reduce((s, i) => s + i.voluntarios.length, 0),
    }));
  }, [escalas]);

  const [tabAtiva, setTabAtiva] = useState(grupos[0]?.nome ?? "");
  const grupoAtivo = grupos.find((g) => g.nome === tabAtiva) ?? grupos[0];

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Escalas</h1>
          <p className="text-sm text-slate-500 mt-1">
            Organize sua equipe filtrando por ministério para visualizar escalados e pendências.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {canGerarTodos && (
            <fetcher.Form method="post" className="shrink-0">
              <input type="hidden" name="intent" value="gerar-todos-ministerios" />
              <Button type="submit" variant="blue" size="sm" loading={fetcher.state === "submitting"}>
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Gerar Todos
              </Button>
            </fetcher.Form>
          )}
          <Link to="/app/escalas/novo" className="shrink-0">
            <Button type="button" variant="secondary" size="sm">+ Nova Escala</Button>
          </Link>
        </div>
      </div>

      {/* ── Texto explicativo: Gerar Todos ── */}
      {canGerarTodos && (
        <div className="mb-4 p-3 bg-slate-50 border border-slate-200 rounded-lg">
          <ul className="space-y-1 text-xs text-slate-600">
            <li><strong>O que faz:</strong> gera as escalas do mês atual para todos os ministérios ativos de uma só vez.</li>
            <li><strong>Quem pode usar:</strong> restrito a ADMIN, PASTOR e SECRETARIO.</li>
            <li><strong>Depois de gerar:</strong> cada escala pode ser editada individualmente — acesse o ministério para ajustar voluntários.</li>
            <li><strong>Re-gerar:</strong> escalas manuais e editadas são preservadas. Apenas escalas automáticas do mês são substituídas.</li>
          </ul>
        </div>
      )}

      {/* ── Texto explicativo: Lista de Escalas ── */}
      <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <ul className="space-y-1 text-xs text-slate-600">
          <li><strong className="text-blue-700">Badge "Auto":</strong> indica que a escala foi gerada automaticamente pelo sistema.</li>
          <li><strong className="text-blue-700">Editar voluntários:</strong> clique no ícone de edição para adicionar, remover ou trocar membros de cada função.</li>
          <li><strong className="text-blue-700">Alterar status:</strong> mude o status da escala entre Pendente, Confirmada, Realizada ou Cancelada.</li>
          <li><strong className="text-blue-700">Preservação:</strong> ao re-gerar escalas do mês, apenas as automáticas não-editadas são substituídas. Suas edições manuais são mantidas.</li>
        </ul>
      </div>

      {/* ── Tabs de Ministérios ── */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1 mb-6 scrollbar-hide">
        {grupos.map((g) => {
          const ativo = tabAtiva === g.nome;
          return (
            <button
              key={g.nome}
              type="button"
              onClick={() => setTabAtiva(g.nome)}
              className={`flex flex-col items-center justify-center gap-1 w-28 h-20 rounded-xl border transition-all shrink-0 ${
                ativo
                  ? "bg-blue-50 border-blue-200 text-blue-700"
                  : "bg-white border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-700"
              }`}
            >
              <span className="text-lg leading-none">{getIcon(g.nome)}</span>
              <span className="text-[10px] font-bold uppercase tracking-wider">{g.nome}</span>
              {g.totalVoluntarios > 0 && (
                <span className={`text-[10px] font-semibold ${ativo ? "text-blue-600" : "text-slate-400"}`}>
                  {g.totalVoluntarios} Escalados
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Layout Principal ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-2 space-y-4">
          {grupoAtivo?.items.map((escala) => (
            <div key={escala.id} className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-blue-50 text-blue-600 text-base">
                    {getIcon(escala.ministerioNome)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-extrabold text-slate-900">{escala.titulo}</h3>
                      {escala.geradaAutomaticamente && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                          Auto
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 font-medium">{formatDate(new Date(escala.data))}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {canEdit && (
                    <Form method="post" className="inline">
                      <input type="hidden" name="intent" value="atualizar-status" />
                      <input type="hidden" name="escalaId" value={escala.id} />
                      <select
                        name="status"
                        defaultValue={escala.status}
                        onChange={(e) => e.currentTarget.form?.submit()}
                        className="h-8 px-2 border border-slate-300 rounded-md text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-700"
                      >
                        <option value="PENDENTE">Pendente</option>
                        <option value="CONFIRMADA">Confirmada</option>
                        <option value="REALIZADA">Realizada</option>
                        <option value="CANCELADA">Cancelada</option>
                      </select>
                    </Form>
                  )}
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => setEscalaEditando(escalaEditando === escala.id ? null : escala.id)}
                      className="p-1.5 text-slate-400 hover:text-cyan-600 rounded-md hover:bg-cyan-50 transition-colors"
                      aria-label="Editar voluntários"
                      title="Editar voluntários"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>

              {escala.voluntarios.length === 0 ? (
                <div className="px-5 py-6 text-center text-slate-400 text-sm">
                  Nenhum voluntário escalado.
                </div>
              ) : (
                <div className="divide-y divide-slate-50">
                  {escala.voluntarios.map((v) => {
                    const initials = v.membroNome.split(" ").map((n) => n[0]).join("").substring(0, 2).toUpperCase();
                    return (
                      <div key={v.id} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50/60 transition-colors">
                        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 text-white text-xs font-bold flex items-center justify-center shrink-0">
                          {initials}
                        </div>
                        <span className="text-sm font-semibold text-slate-900 flex-1">{v.membroNome}</span>
                        <span className="text-sm text-slate-600 font-medium">{v.funcao}</span>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                          v.status === "CONFIRMADO"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : v.status === "PENDENTE"
                            ? "bg-amber-50 text-amber-700 border border-amber-200"
                            : "bg-red-50 text-red-700 border border-red-200"
                        }`}>
                          {v.status === "CONFIRMADO" ? "Confirmado" : v.status === "PENDENTE" ? "Pendente" : v.status}
                        </span>
                        {escalaEditando === escala.id && canEdit && (
                          <Form method="post" className="inline">
                            <input type="hidden" name="intent" value="remove-voluntario" />
                            <input type="hidden" name="voluntarioId" value={v.id} />
                            <button
                              type="submit"
                              className="p-1 text-slate-400 hover:text-red-600 rounded-md hover:bg-red-50 transition-colors"
                              aria-label="Remover voluntário"
                            >
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </Form>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {escalaEditando === escala.id && canEdit && (
                <div className="px-5 py-3 bg-slate-50 border-t border-slate-100">
                  <Form method="post" className="flex items-end gap-2">
                    <input type="hidden" name="intent" value="add-voluntario" />
                    <input type="hidden" name="escalaId" value={escala.id} />
                    <div className="flex-1 space-y-1">
                      <label className="block text-xs font-medium text-slate-600">Membro</label>
                      <select
                        name="membroId"
                        value={novoVoluntario.membroId}
                        onChange={(e) => setNovoVoluntario({ ...novoVoluntario, membroId: e.target.value })}
                        className="w-full h-8 px-2 border border-slate-300 rounded-md text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-700"
                        required
                      >
                        <option value="">Selecionar...</option>
                        {membros.map((m) => (
                          <option key={m.id} value={m.id}>{m.nome}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex-1 space-y-1">
                      <label className="block text-xs font-medium text-slate-600">Função</label>
                      <input
                        type="text"
                        name="funcao"
                        placeholder="Ex: Vocal, Guitarrista..."
                        value={novoVoluntario.funcao}
                        onChange={(e) => setNovoVoluntario({ ...novoVoluntario, funcao: e.target.value })}
                        className="w-full h-8 px-2 border border-slate-300 rounded-md text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-700"
                        required
                      />
                    </div>
                    <Button type="submit" variant="blue" size="sm" disabled={!novoVoluntario.membroId || !novoVoluntario.funcao}>
                      + Add
                    </Button>
                  </Form>
                </div>
              )}
            </div>
          ))}

          {(!grupoAtivo || grupoAtivo.items.length === 0) && (
            <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center text-slate-400 text-sm shadow-xs">
              Nenhuma escala encontrada para este ministério.
            </div>
          )}
        </div>

        {/* ── Sidebar ── */}
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-4">
              Resumo de Escalas
            </p>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-700 font-medium">Total de escalas</span>
                <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
                  {escalas.length}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-700 font-medium">Total de voluntários</span>
                <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
                  {escalas.reduce((s, e) => s + e.voluntarios.length, 0)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-700 font-medium">Ministérios</span>
                <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
                  {grupos.length}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-700 font-medium">Escalas automáticas</span>
                <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                  {escalas.filter((e) => e.geradaAutomaticamente).length}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
