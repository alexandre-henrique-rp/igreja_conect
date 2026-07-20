/**
 * Rota /app/escalas — Gestão de Escalas de Voluntários por Ministério.
 */
import { useState, useMemo } from "react";
import { Link } from "react-router";
import type { Route } from "./+types/escalas._index";
import { userContext } from "~/lib/user-context";
import { listarEscalas } from "~/lib/escalas.server";
import type { EscalaComVoluntarios } from "~/lib/escalas.server";

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

export function meta(_args: Route.MetaArgs) {
  return [{ title: "Escalas · Igreja Conect" }];
}

export async function loader({ context }: Route.LoaderArgs) {
  const user = context.get(userContext);
  if (!user) throw new Response("Não autenticado.", { status: 401 });
  const escalas = await listarEscalas(user);
  return { user, escalas };
}

export default function EscalasIndex({ loaderData }: Route.ComponentProps) {
  const { escalas } = loaderData;

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
  const voluntarios = grupoAtivo
    ? grupoAtivo.items.flatMap((e) =>
        e.voluntarios.map((v) => ({
          id: v.id,
          nome: v.membroNome,
          funcao: v.funcao,
          titulo: e.titulo,
          data: e.data,
          status: v.status,
        }))
      )
    : [];

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
          <Link to="/app/escalas/novo" className="shrink-0">
            <button
              type="button"
              className="flex items-center gap-2 px-4 h-9 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap"
            >
              + Nova Escala
            </button>
          </Link>
        </div>
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

      {/* ── Layout Principal: Conteúdo + Sidebar ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* ── Coluna Principal (2/3) ── */}
        <div className="lg:col-span-2 space-y-4">
          {/* Card da escala do ministério */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
            {/* Header do card */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-blue-50 text-blue-600 text-base">
                  {grupoAtivo ? getIcon(grupoAtivo.nome) : "📋"}
                </div>
                <div>
                  <h2 className="text-sm font-extrabold text-slate-900 uppercase tracking-wide">
                    {grupoAtivo ? `Ministério de ${grupoAtivo.nome}` : "Nenhum ministério"}
                  </h2>
                  <p className="text-xs text-slate-400 font-medium">{grupoAtivo?.items.length ?? 0} escala(s)</p>
                </div>
              </div>
            </div>

            {/* Tabela de voluntários */}
            {voluntarios.length === 0 ? (
              <div className="px-5 py-10 text-center text-slate-400 text-sm">
                Nenhum voluntário escalado para este ministério.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="text-left px-5 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Voluntário</th>
                      <th className="text-left px-5 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Função</th>
                      <th className="text-left px-5 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Escala</th>
                      <th className="text-left px-5 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {voluntarios.map((v) => {
                      const initials = v.nome.split(" ").map((n) => n[0]).join("").substring(0, 2).toUpperCase();
                      return (
                        <tr key={v.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-3">
                              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 text-white text-xs font-bold flex items-center justify-center shrink-0">
                                {initials}
                              </div>
                              <span className="text-sm font-semibold text-slate-900">{v.nome}</span>
                            </div>
                          </td>
                          <td className="px-5 py-3.5 text-sm text-slate-600 font-medium">
                            {v.funcao}
                          </td>
                          <td className="px-5 py-3.5">
                            <p className="text-sm font-semibold text-slate-800">{v.titulo}</p>
                            <p className="text-[10px] text-slate-400 font-medium">{formatDate(new Date(v.data))}</p>
                          </td>
                          <td className="px-5 py-3.5">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                              v.status === "CONFIRMADO"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : v.status === "PENDENTE"
                                ? "bg-amber-50 text-amber-700 border border-amber-200"
                                : "bg-red-50 text-red-700 border border-red-200"
                            }`}>
                              {v.status === "CONFIRMADO" ? "Confirmado" : v.status === "PENDENTE" ? "Pendente" : v.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* ── Sidebar Direita (1/3) ── */}
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
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
