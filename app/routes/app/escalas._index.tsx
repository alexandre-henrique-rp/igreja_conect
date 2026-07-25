/**
 * Rota /app/escalas — Gestão de Escalas de Voluntários por Ministério.
 */
import { useState, useMemo } from "react";
import { Link, Form, useFetcher, redirect } from "react-router";
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

export async function loader({ context, request }: Route.LoaderArgs) {
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

  const url = new URL(request.url);
  const geradoParam = url.searchParams.get("gerado");
  const mensagemGerado = geradoParam
    ? `${geradoParam} escala(s) gerada(s) automaticamente.`
    : null;

  // Pré-requisitos para geração automática de escalas
  const inicioMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const ministerios = await prisma.ministerio.findMany({
    where: { status: "ATIVO" },
    select: {
      id: true,
      nome: true,
      funcoes: {
        select: { id: true, nome: true },
        orderBy: { nome: "asc" },
      },
      _count: {
        select: { funcoes: true, membros: true, atividades: { where: { data: { gte: inicioMes } } } },
      },
    },
    orderBy: { nome: "asc" },
  });

  const ministeriosSemFuncoes = ministerios.filter((m) => m._count.funcoes === 0);
  const ministeriosSemMembros = ministerios.filter((m) => m._count.membros === 0);
  const ministeriosSemAtividades = ministerios.filter((m) => m._count.atividades === 0);

  const todosOsRequisitos =
    ministerios.length > 0 &&
    ministeriosSemFuncoes.length === 0 &&
    ministeriosSemMembros.length === 0 &&
    ministeriosSemAtividades.length === 0;

  return {
    user,
    escalas,
    canGerarTodos,
    canEdit,
    membros,
    mensagemGerado,
    ministerios,
    ministeriosSemFuncoes,
    ministeriosSemMembros,
    ministeriosSemAtividades,
    todosOsRequisitos,
  };
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
    const total = result.totalEscalas;
    return redirect(`/app/escalas?gerado=${total}`);
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

function EmptyStateEscalas({
  ministerios,
  ministeriosSemFuncoes,
  ministeriosSemMembros,
  ministeriosSemAtividades,
  todosOsRequisitos,
  canGerarTodos,
}: {
  ministerios: { id: string; nome: string }[];
  ministeriosSemFuncoes: { id: string; nome: string }[];
  ministeriosSemMembros: { id: string; nome: string }[];
  ministeriosSemAtividades: { id: string; nome: string }[];
  todosOsRequisitos: boolean;
  canGerarTodos: boolean;
}) {
  if (ministerios.length === 0) {
    return (
      <div className="text-center">
        <h3 className="text-lg font-bold text-slate-900 mb-2">Nenhum ministério cadastrado</h3>
        <p className="text-sm text-slate-600 mb-4">
          Para criar escalas, primeiro cadastre os ministérios da igreja.
        </p>
        <Link
          to="/app/ministerios/novo"
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 h-10 text-sm font-bold text-white hover:bg-blue-700 transition-colors"
        >
          + Novo Ministério
        </Link>
      </div>
    );
  }

  if (!todosOsRequisitos) {
    return (
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-bold text-slate-900 mb-1">Faltam informações para gerar escalas</h3>
          <p className="text-sm text-slate-600">
            O gerador automático precisa de: <strong>funções</strong>, <strong>membros vinculados</strong> e <strong>atividades (cultos/ensaios)</strong> em cada ministério.
          </p>
        </div>

        {ministeriosSemFuncoes.length > 0 && (
          <RequisitoPendente
            titulo="Ministérios sem funções cadastradas"
            itens={ministeriosSemFuncoes}
          />
        )}
        {ministeriosSemMembros.length > 0 && (
          <RequisitoPendente
            titulo="Ministérios sem membros vinculados"
            itens={ministeriosSemMembros}
          />
        )}
        {ministeriosSemAtividades.length > 0 && (
          <RequisitoPendente
            titulo="Ministérios sem atividades no mês atual"
            itens={ministeriosSemAtividades}
          />
        )}
      </div>
    );
  }

  return (
    <div className="text-center">
      <h3 className="text-lg font-bold text-slate-900 mb-2">Tudo pronto para gerar as escalas!</h3>
      <p className="text-sm text-slate-600 mb-4">
        Todos os ministérios têm funções, membros e atividades no mês atual. Clique em "Gerar Todos" para criar as escalas automaticamente.
      </p>
      {!canGerarTodos && (
        <p className="text-xs text-slate-500">
          Apenas ADMIN, PASTOR ou SECRETARIO podem gerar escalas automaticamente.
        </p>
      )}
    </div>
  );
}

function RequisitoPendente({ titulo, itens }: { titulo: string; itens: { id: string; nome: string }[] }) {
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
      <h4 className="text-sm font-bold text-amber-800 mb-2">{titulo}</h4>
      <ul className="space-y-2">
        {itens.map((m) => (
          <li key={m.id} className="flex items-center justify-between">
            <span className="text-sm text-amber-900">{m.nome}</span>
            <Link
              to={`/app/ministerios/${m.id}`}
              className="text-xs font-semibold text-amber-700 hover:text-amber-900 hover:underline"
            >
              Completar cadastro →
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function formatDiaSemana(data: Date): string {
  const dias = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  return dias[data.getDay()];
}

function EscalasPorData({
  gruposPorData,
  getIcon,
  canEdit,
  setEscalaEditando,
  escalaEditando,
  novoVoluntario,
  setNovoVoluntario,
  membros,
  ministerios,
}: {
  gruposPorData: { key: string; data: Date; items: EscalaComVoluntarios[] }[];
  getIcon: (nome: string) => string;
  canEdit: boolean;
  setEscalaEditando: (id: string | null) => void;
  escalaEditando: string | null;
  novoVoluntario: { membroId: string; funcao: string };
  setNovoVoluntario: (v: { membroId: string; funcao: string }) => void;
  membros: { id: string; nome: string }[];
  ministerios: any[];
}) {
  if (gruposPorData.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center text-slate-400 text-sm">
        Nenhuma escala programada.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {gruposPorData.map((grupo) => (
        <div key={grupo.key} className="relative pl-6 border-l-2 border-blue-200">
          <div className="absolute -left-[9px] top-0 h-5 w-5 rounded-full bg-blue-100 border-2 border-blue-300 flex items-center justify-center">
            <span className="block h-1.5 w-1.5 rounded-full bg-blue-500" />
          </div>
          <div className="mb-3">
            <h3 className="text-sm font-extrabold text-slate-900">
              {formatDiaSemana(grupo.data)}, {formatDate(grupo.data)}
            </h3>
          </div>
          <div className="space-y-3">
            {grupo.items.map((escala) => (
              <EscalaCard
                key={escala.id}
                escala={escala}
                getIcon={getIcon}
                canEdit={canEdit}
                escalaEditando={escalaEditando}
                setEscalaEditando={setEscalaEditando}
                novoVoluntario={novoVoluntario}
                setNovoVoluntario={setNovoVoluntario}
                membros={membros}
                ministerios={ministerios}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function EscalaCard({
  escala,
  getIcon,
  canEdit,
  escalaEditando,
  setEscalaEditando,
  novoVoluntario,
  setNovoVoluntario,
  membros,
  ministerios,
}: {
  escala: EscalaComVoluntarios;
  getIcon: (nome: string) => string;
  canEdit: boolean;
  escalaEditando: string | null;
  setEscalaEditando: (id: string | null) => void;
  novoVoluntario: { membroId: string; funcao: string };
  setNovoVoluntario: (v: { membroId: string; funcao: string }) => void;
  membros: { id: string; nome: string }[];
  ministerios: any[];
}) {
  const isEditing = escalaEditando === escala.id;

  const ministerioDaEscala = ministerios.find((m) => m.id === escala.ministerioId);
  const funcoesDoMinisterio = ministerioDaEscala?.funcoes ?? [];
  const funcoesPadraoFallback = [
    "Apoio",
    "Violão",
    "Guitarra",
    "Teclado",
    "Bateria",
    "Contrabaixo",
    "Vocal Principal",
    "Backing Vocal",
    "Operador de Som",
    "Projeção / Mídia",
    "Recepcionista",
    "Líder de Equipe",
  ];
  const funcoesDisponiveis = funcoesDoMinisterio.length > 0
    ? funcoesDoMinisterio.map((f: any) => f.nome)
    : funcoesPadraoFallback;

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-blue-50 text-blue-600 text-base">{getIcon(escala.ministerioNome)}</div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-extrabold text-slate-900">{escala.titulo}</h3>
              <span className="text-xs text-slate-500">({escala.ministerioNome})</span>
              {escala.geradaAutomaticamente && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  Auto
                </span>
              )}
              {escala.cultoId && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                  Culto
                </span>
              )}
              {escala.eventoId && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                  Evento
                </span>
              )}
            </div>
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
              onClick={() => setEscalaEditando(isEditing ? null : escala.id)}
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
        <div className="px-5 py-6 text-center text-slate-400 text-sm">Nenhum voluntário escalado.</div>
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
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                    v.status === "CONFIRMADO"
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                      : v.status === "PENDENTE"
                      ? "bg-amber-50 text-amber-700 border border-amber-200"
                      : "bg-red-50 text-red-700 border border-red-200"
                  }`}
                >
                  {v.status === "CONFIRMADO" ? "Confirmado" : v.status === "PENDENTE" ? "Pendente" : v.status}
                </span>
                {isEditing && canEdit && (
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

      {isEditing && canEdit && (
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
              <select
                name="funcao"
                value={novoVoluntario.funcao}
                onChange={(e) => setNovoVoluntario({ ...novoVoluntario, funcao: e.target.value })}
                className="w-full h-8 px-2 border border-slate-300 rounded-md text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-700"
                required
              >
                <option value="">Selecionar...</option>
                {funcoesDisponiveis.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>
            <Button type="submit" variant="blue" size="sm" disabled={!novoVoluntario.membroId || !novoVoluntario.funcao}>
              + Add
            </Button>
          </Form>
        </div>
      )}
    </div>
  );
}

export default function EscalasIndex({ loaderData }: Route.ComponentProps) {
  const {
    escalas,
    canGerarTodos,
    canEdit,
    membros,
    mensagemGerado,
    ministerios,
    ministeriosSemFuncoes,
    ministeriosSemMembros,
    ministeriosSemAtividades,
    todosOsRequisitos,
  } = loaderData;
  const fetcher = useFetcher();

  const [escalaEditando, setEscalaEditando] = useState<string | null>(null);
  const [novoVoluntario, setNovoVoluntario] = useState({ membroId: "", funcao: "" });
  const [modoVisualizacao, setModoVisualizacao] = useState<"ministerio" | "data">("data");

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

  const gruposPorData = useMemo(() => {
    const map = new Map<string, EscalaComVoluntarios[]>();
    for (const e of escalas) {
      const d = new Date(e.data);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const existing = map.get(key) ?? [];
      existing.push(e);
      map.set(key, existing);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, items]) => ({ key, data: new Date(`${key}T00:00:00`), items }));
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
          {mensagemGerado && (
            <p className="text-sm text-green-700 bg-green-50 px-3 py-1 rounded-full border border-green-200">
              {mensagemGerado}
            </p>
          )}
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

      {/* ── Toggle de Visualização ── */}
      <div className="flex items-center gap-2 mb-4">
        <button
          type="button"
          onClick={() => setModoVisualizacao("data")}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
            modoVisualizacao === "data"
              ? "bg-blue-600 text-white"
              : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
          }`}
        >
          Próximos Eventos
        </button>
        <button
          type="button"
          onClick={() => setModoVisualizacao("ministerio")}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
            modoVisualizacao === "ministerio"
              ? "bg-blue-600 text-white"
              : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
          }`}
        >
          Por Ministério
        </button>
      </div>

      {modoVisualizacao === "ministerio" && (
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
      )}

      {/* ── Layout Principal ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-2 space-y-4">
          {modoVisualizacao === "data" ? (
            <EscalasPorData
              gruposPorData={gruposPorData}
              getIcon={getIcon}
              canEdit={canEdit}
              setEscalaEditando={setEscalaEditando}
              escalaEditando={escalaEditando}
              novoVoluntario={novoVoluntario}
              setNovoVoluntario={setNovoVoluntario}
              membros={membros}
              ministerios={ministerios}
            />
          ) : (
            grupoAtivo?.items.map((escala) => (
              <EscalaCard
                key={escala.id}
                escala={escala}
                getIcon={getIcon}
                canEdit={canEdit}
                escalaEditando={escalaEditando}
                setEscalaEditando={setEscalaEditando}
                novoVoluntario={novoVoluntario}
                setNovoVoluntario={setNovoVoluntario}
                membros={membros}
                ministerios={ministerios}
              />
            ))
          )}

          {modoVisualizacao === "ministerio" && (!grupoAtivo || grupoAtivo.items.length === 0) && (
            <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-xs">
              {escalas.length === 0 ? (
                <EmptyStateEscalas
                  ministerios={ministerios}
                  ministeriosSemFuncoes={ministeriosSemFuncoes}
                  ministeriosSemMembros={ministeriosSemMembros}
                  ministeriosSemAtividades={ministeriosSemAtividades}
                  todosOsRequisitos={todosOsRequisitos}
                  canGerarTodos={canGerarTodos}
                />
              ) : (
                <div className="text-center text-slate-400 text-sm">
                  Nenhuma escala encontrada para este ministério.
                </div>
              )}
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
