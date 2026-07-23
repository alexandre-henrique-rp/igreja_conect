/**
 * Rota /app/ministerios/:id — editar ministério.
 *
 * Exibe formulário de edição com:
 * - Informações Básicas (nome, descrição, status, cor)
 * - Detalhes Operacionais (líder, capacidade, dias, horário, turno)
 * - Membros do Ministério (tabela com add/remove)
 */
import { useState, useMemo } from "react";
import { Form, Link, useNavigation, useFetcher } from "react-router";
import type { Route } from "./+types/ministerios.$id";
import { userContext } from "~/lib/user-context";
import { prisma } from "~/db/prisma.server";
import { z } from "zod";
import {
  addMembroToMinisterio,
  removeMembroFromMinisterio,
  toggleLiderMinisterio,
  updateMinisterio,
} from "~/lib/ministries.server";
import { criarFuncao, removerFuncao, atribuirFuncaoMembro } from "~/lib/funcoesMinisterio.server";
import {
  listarAtividades,
  criarAtividade,
  removerAtividade,
  criarIndisponibilidade,
  removerIndisponibilidade,
  gerarCultosRecorrentes,
} from "~/lib/disponibilidades.server";
import { gerarEscalasMes } from "~/lib/gerarEscalas.server";
import { Button } from "~/components/Button";
import { Input } from "~/components/Input";
import { Select } from "~/components/Select";
import { Breadcrumb } from "~/components/Breadcrumb";
import { ErrorAlert } from "~/components/ErrorAlert";
import { ConflictError, NomeDuplicadoError } from "~/lib/errors";
import { GerenciarFuncoes } from "~/components/GerenciarFuncoes";
import { ModalDisponibilidade } from "~/components/ModalDisponibilidade";
import type { AtividadeCalendario, IndisponibilidadeCalendario } from "~/components/CalendarioDisponibilidade";

/** Cargos que podem gerenciar ministérios. */
const CAN_MANAGE = ["ADMIN", "PASTOR", "SECRETARIO", "LIDER_MINISTERIO"] as const;

export function meta({ data }: Route.MetaArgs) {
  const nome = (data as { ministerio?: { nome?: string } } | undefined)?.ministerio?.nome ?? "Ministério";
  return [{ title: `Editar ${nome} · Igreja Conect` }];
}

const UpdateSchema = z.object({
  nome: z.string().min(2, "Nome deve ter ao menos 2 caracteres.").max(80),
  descricao: z.string().max(500).optional(),
  status: z.enum(["ATIVO", "INATIVO", "SUSPENSO"]).optional(),
  corDestaque: z.string().max(20).optional(),
  liderNome: z.string().max(120).optional(),
  liderId: z.string().optional(),
  capacidadeMaxima: z.string().optional(),
  diasEncontro: z.string().max(50).optional(),
  horarioPadrao: z.string().max(10).optional(),
  turnoPrincipal: z.enum(["MANHA", "TARDE", "NOITE"]).optional(),
});

/**
 * Loader: busca dados do ministério e membros vinculados.
 */
export async function loader({ context, params }: Route.LoaderArgs) {
  const user = context.get(userContext);
  if (!user) throw new Response("Não autenticado.", { status: 401 });

  const ministerioId = params.id;
  if (!ministerioId) throw new Response("ID não fornecido.", { status: 400 });

  const ministerio = await prisma.ministerio.findUnique({
    where: { id: ministerioId },
    include: {
      membros: {
        include: {
          membro: {
            select: { id: true, nome: true, tipo: true, cargo: true },
          },
          funcao: { select: { id: true, nome: true, cor: true } },
        },
        orderBy: { membro: { nome: "asc" } },
      },
      funcoes: { orderBy: { nome: "asc" } },
    },
  });

  if (!ministerio) throw new Response("Ministério não encontrado.", { status: 404 });

  const canEdit =
    user.cargo != null && (CAN_MANAGE as readonly string[]).includes(user.cargo);

  // Membros disponíveis para adicionar (excluindo já vinculados)
  const vinculadosIds = ministerio.membros.map((mm) => mm.membro.id);
  const membrosDisponiveis = await prisma.membro.findMany({
    where: { id: { notIn: vinculadosIds } },
    select: { id: true, nome: true },
    orderBy: { nome: "asc" },
    take: 100,
  });

  // Buscar atividades e indisponibilidades do mês atual
  const agora = new Date();
  const mes = agora.getMonth() + 1;
  const ano = agora.getFullYear();

  const [atividadesRaw, indisponibilidadesRaw] = await Promise.all([
    listarAtividades(ministerioId, undefined, mes, ano),
    Promise.resolve([] as Array<{ id: string; dataInicio: string; dataFim: string; motivo: string | null }>),
  ]);

  const atividades: AtividadeCalendario[] = atividadesRaw.map((a) => ({
    id: a.id,
    tipo: a.tipo,
    data: a.data.toISOString(),
    horario: a.horario,
    descricao: a.descricao,
  }));

  return {
    ministerio: {
      id: ministerio.id,
      nome: ministerio.nome,
      descricao: ministerio.descricao,
      status: ministerio.status,
      corDestaque: ministerio.corDestaque,
      liderNome: ministerio.liderNome,
      capacidadeMaxima: ministerio.capacidadeMaxima,
      diasEncontro: ministerio.diasEncontro,
      horarioPadrao: ministerio.horarioPadrao,
      turnoPrincipal: ministerio.turnoPrincipal,
      createdAt: ministerio.createdAt,
      updatedAt: ministerio.updatedAt,
    },
    membros: ministerio.membros.map((mm) => ({
      vinculoId: mm.id,
      membroId: mm.membro.id,
      nome: mm.membro.nome,
      tipo: mm.membro.tipo,
      cargo: mm.membro.cargo,
      lider: mm.lider,
      funcaoId: mm.funcao?.id ?? null,
      funcaoNome: mm.funcao?.nome ?? null,
    })),
    funcoes: ministerio.funcoes.map((f) => ({
      id: f.id,
      nome: f.nome,
      cor: f.cor,
    })),
    membrosDisponiveis,
    canEdit,
    atividades,
  };
}

/**
 * Action: update de dados do ministério ou vincular/desvincular membros.
 */
export async function action({ context, request, params }: Route.ActionArgs) {
  const user = context.get(userContext);
  if (!user) throw new Response("Não autenticado.", { status: 401 });

  const canEdit =
    user.cargo != null && (CAN_MANAGE as readonly string[]).includes(user.cargo);
  if (!canEdit) throw new Response("Sem permissão.", { status: 403 });

  const ministerioId = params.id;
  if (!ministerioId) throw new Response("ID não fornecido.", { status: 400 });

  const formData = await request.formData();
  const intent = formData.get("intent");

  // ── Update dados do ministério ──
  if (intent === "update") {
    const raw = {
      nome: String(formData.get("nome") ?? ""),
      descricao: formData.get("descricao") ? String(formData.get("descricao")) : undefined,
      status: formData.get("status") ? String(formData.get("status")) : undefined,
      corDestaque: formData.get("corDestaque") ? String(formData.get("corDestaque")) : undefined,
      liderNome: formData.get("liderNome") ? String(formData.get("liderNome")) : undefined,
      capacidadeMaxima: formData.get("capacidadeMaxima") ? String(formData.get("capacidadeMaxima")) : undefined,
      diasEncontro: formData.get("diasEncontro") ? String(formData.get("diasEncontro")) : undefined,
      horarioPadrao: formData.get("horarioPadrao") ? String(formData.get("horarioPadrao")) : undefined,
      turnoPrincipal: formData.get("turnoPrincipal") ? String(formData.get("turnoPrincipal")) : undefined,
    };

    const parsed = UpdateSchema.safeParse(raw);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path.join(".");
        if (path && !fieldErrors[path]) fieldErrors[path] = issue.message;
      }
      return new Response(JSON.stringify({ fieldErrors }), {
        status: 422,
        headers: { "Content-Type": "application/json" },
      });
    }

    try {
      await updateMinisterio(
        ministerioId,
        {
          nome: parsed.data.nome,
          descricao: parsed.data.descricao,
          status: parsed.data.status as "ATIVO" | "INATIVO" | "SUSPENSO" | undefined,
          corDestaque: parsed.data.corDestaque,
          liderNome: parsed.data.liderNome,
          capacidadeMaxima: parsed.data.capacidadeMaxima
            ? Number(parsed.data.capacidadeMaxima)
            : undefined,
          diasEncontro: parsed.data.diasEncontro,
          horarioPadrao: parsed.data.horarioPadrao,
          turnoPrincipal: parsed.data.turnoPrincipal as "MANHA" | "TARDE" | "NOITE" | undefined,
        },
        user
      );

      // Se um líder foi selecionado, garantir vínculo + flag lider=true
      const liderId = parsed.data.liderId;
      if (liderId) {
        // Tenta adicionar o membro (ignora se já estiver vinculado)
        try {
          await addMembroToMinisterio(ministerioId, liderId, user);
        } catch (e) {
          if (!(e instanceof ConflictError)) throw e;
        }
        // Marca como líder (toggle aceita o estado atual e inverte)
        // Precisa garantir que lider=true: busca o vínculo e seta diretamente
        const vinculo = await prisma.ministerioMembro.findUnique({
          where: { membroId_ministerioId: { membroId: liderId, ministerioId } },
        });
        if (vinculo && !vinculo.lider) {
          await prisma.ministerioMembro.update({
            where: { membroId_ministerioId: { membroId: liderId, ministerioId } },
            data: { lider: true },
          });
        }
      }

      return new Response(null, {
        status: 302,
        headers: { Location: `/app/ministerios/${ministerioId}` },
      });
    } catch (e) {
      if (e && typeof e === "object" && "code" in e && (e as { code: string }).code === "P2002") {
        throw new NomeDuplicadoError("Já existe um ministério com este nome.");
      }
      throw e;
    }
  }

  // ── Adicionar membro ──
  if (intent === "add-membro") {
    const membroId = String(formData.get("membroId") ?? "");
    if (!membroId) throw new Response("membroId obrigatório.", { status: 400 });
    try {
      await addMembroToMinisterio(ministerioId, membroId, user);
    } catch (e) {
      if (e instanceof ConflictError) {
        throw new Response("Este membro já está neste ministério.", { status: 409 });
      }
      throw e;
    }
    return new Response(null, {
      status: 302,
      headers: { Location: `/app/ministerios/${ministerioId}` },
    });
  }

  // ── Remover membro ──
  if (intent === "remove-membro") {
    const membroId = String(formData.get("membroId") ?? "");
    if (!membroId) throw new Response("membroId obrigatório.", { status: 400 });
    await removeMembroFromMinisterio(ministerioId, membroId, user);
    return new Response(null, {
      status: 302,
      headers: { Location: `/app/ministerios/${ministerioId}` },
    });
  }

  if (intent === "toggle-lider") {
    const membroId = String(formData.get("membroId") ?? "");
    if (!membroId) throw new Response("membroId obrigatório.", { status: 400 });
    await toggleLiderMinisterio(ministerioId, membroId, user);
    return new Response(null, {
      status: 302,
      headers: { Location: `/app/ministerios/${ministerioId}` },
    });
  }

  // ── Adicionar função ──
  if (intent === "add-funcao") {
    const nome = String(formData.get("nome") ?? "");
    const cor = String(formData.get("cor") ?? "");
    if (!nome) throw new Response("Nome da função é obrigatório.", { status: 400 });
    try {
      await criarFuncao(ministerioId, { nome, cor: cor || undefined }, user);
    } catch (e) {
      if (e instanceof ConflictError) {
        throw new Response("Já existe uma função com este nome.", { status: 409 });
      }
      throw e;
    }
    return new Response(null, {
      status: 302,
      headers: { Location: `/app/ministerios/${ministerioId}` },
    });
  }

  // ── Remover função ──
  if (intent === "remove-funcao") {
    const funcaoId = String(formData.get("funcaoId") ?? "");
    if (!funcaoId) throw new Response("funcaoId obrigatório.", { status: 400 });
    await removerFuncao(funcaoId, user);
    return new Response(null, {
      status: 302,
      headers: { Location: `/app/ministerios/${ministerioId}` },
    });
  }

  // ── Atribuir função a membro ──
  if (intent === "atribuir-funcao") {
    const vinculoId = String(formData.get("vinculoId") ?? "");
    const funcaoId = String(formData.get("funcaoId") ?? "") || null;
    if (!vinculoId) throw new Response("vinculoId obrigatório.", { status: 400 });
    await atribuirFuncaoMembro({ vinculoId, funcaoId }, user);
    return new Response(null, {
      status: 302,
      headers: { Location: `/app/ministerios/${ministerioId}` },
    });
  }

  // ── Adicionar atividade (ensaio ou atividade extra) ──
  if (intent === "add-atividade") {
    const tipo = String(formData.get("tipo") ?? "ENSAIO");
    const data = String(formData.get("data") ?? "");
    const horario = String(formData.get("horario") ?? "19:30");
    const descricao = String(formData.get("descricao") ?? "");
    const membroId = String(formData.get("membroId") ?? "") || undefined;
    if (!data) throw new Response("Data é obrigatória.", { status: 400 });
    await criarAtividade(
      { ministerioId, membroId, tipo: tipo as "ENSAIO" | "ATIVIDADE_EXTRA", data, horario, descricao: descricao || undefined },
      user,
    );
    return new Response(null, {
      status: 302,
      headers: { Location: `/app/ministerios/${ministerioId}` },
    });
  }

  // ── Remover atividade ──
  if (intent === "remove-atividade") {
    const atividadeId = String(formData.get("atividadeId") ?? "");
    if (!atividadeId) throw new Response("atividadeId obrigatório.", { status: 400 });
    await removerAtividade(atividadeId, user);
    return new Response(null, {
      status: 302,
      headers: { Location: `/app/ministerios/${ministerioId}` },
    });
  }

  // ── Adicionar indisponibilidade ──
  if (intent === "add-indisponibilidade") {
    const membroId = String(formData.get("membroId") ?? "");
    const dataInicio = String(formData.get("dataInicio") ?? "");
    const dataFim = String(formData.get("dataFim") ?? dataInicio);
    const motivo = String(formData.get("motivo") ?? "");
    if (!membroId || !dataInicio) throw new Response("membroId e dataInicio são obrigatórios.", { status: 400 });
    await criarIndisponibilidade(
      { ministerioId, membroId, dataInicio, dataFim, motivo: motivo || undefined },
      user,
    );
    return new Response(null, {
      status: 302,
      headers: { Location: `/app/ministerios/${ministerioId}` },
    });
  }

  // ── Remover indisponibilidade ──
  if (intent === "remove-indisponibilidade") {
    const indisponibilidadeId = String(formData.get("indisponibilidadeId") ?? "");
    if (!indisponibilidadeId) throw new Response("indisponibilidadeId obrigatório.", { status: 400 });
    await removerIndisponibilidade(indisponibilidadeId, user);
    return new Response(null, {
      status: 302,
      headers: { Location: `/app/ministerios/${ministerioId}` },
    });
  }

  // ── Gerar escalas do mês ──
  if (intent === "gerar-escalas") {
    const agora = new Date();
    const mes = agora.getMonth() + 1;
    const ano = agora.getFullYear();
    await gerarCultosRecorrentes(ministerioId, mes, ano, user);
    const result = await gerarEscalasMes(ministerioId, mes, ano, user);
    return new Response(
      JSON.stringify({ ok: true, escalasCriadas: result.escalasCriadas }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }

  throw new Response("Intent não reconhecido.", { status: 400 });
}

// ─────────────────────────────────────────────────────────────
// Componentes auxiliares

const DIAS_SEMANA = [
  { key: "DOM", label: "Domingo" },
  { key: "SEG", label: "Segunda" },
  { key: "TER", label: "Terça" },
  { key: "QUA", label: "Quarta" },
  { key: "QUI", label: "Quinta" },
  { key: "SEX", label: "Sexta" },
  { key: "SAB", label: "Sábado" },
];

const STATUS_OPTIONS = [
  { value: "ATIVO", label: "Ativo" },
  { value: "INATIVO", label: "Inativo" },
  { value: "SUSPENSO", label: "Suspenso" },
];

const TURNO_OPTIONS = [
  { value: "MANHA", label: "Manhã" },
  { value: "TARDE", label: "Tarde" },
  { value: "NOITE", label: "Noite" },
];

function tipoLabel(tipo: string | null): string {
  switch (tipo) {
    case "MEMBRO_ATIVO": return "Membro";
    case "VISITANTE": return "Visitante";
    case "CONGREGADO": return "Congregado";
    default: return tipo ?? "—";
  }
}

// ─────────────────────────────────────────────────────────────

export default function MinisterioEditar({ loaderData, actionData }: Route.ComponentProps) {
  const { ministerio, membros, membrosDisponiveis, canEdit, funcoes, atividades } = loaderData;
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const fetcher = useFetcher();

  const fieldErrors = (actionData as { fieldErrors?: Record<string, string> } | undefined)?.fieldErrors;

  // Estado local para dias e cor
  const [diasSelecionados, setDiasSelecionados] = useState<string[]>(
    ministerio.diasEncontro
      ? ministerio.diasEncontro.split(",").filter(Boolean)
      : ["DOM", "QUA"]
  );
  const [corDestaque, setCorDestaque] = useState(ministerio.corDestaque ?? "#3B82F6");

  // Liderança
  const [liderNome, setLiderNome] = useState("");
  const [liderSelecionado, setLiderSelecionado] = useState<{ id: string; nome: string } | null>(
    ministerio.liderNome ? { id: "", nome: ministerio.liderNome } : null
  );
  const [showLiderDropdown, setShowLiderDropdown] = useState(false);

  // Adicionar membro
  const [showAddMembro, setShowAddMembro] = useState(false);
  const [membroBusca, setMembroBusca] = useState("");

  // Modal de disponibilidade
  const [membroDisponibilidade, setMembroDisponibilidade] = useState<{ id: string; nome: string } | null>(null);
  const [formAtividade, setFormAtividade] = useState<{ data: string; tipo: "ENSAIO" | "ATIVIDADE_EXTRA" } | null>(null);
  const [formIndisponibilidade, setFormIndisponibilidade] = useState<string | null>(null);

  const membrosDisponiveisFiltrados = membrosDisponiveis.filter((m) =>
    m.nome.toLowerCase().includes(membroBusca.toLowerCase())
  );

  function toggleDia(key: string) {
    setDiasSelecionados((prev) =>
      prev.includes(key) ? prev.filter((d) => d !== key) : [...prev, key]
    );
  }

  const PALETTE = ["#3B82F6", "#8B5CF6", "#EC4899", "#EF4444", "#F59E0B", "#10B981", "#06B6D4", "#6366F1"];

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto">
      {/* Breadcrumb */}
      <Breadcrumb
        items={[
          { label: "Ministérios", href: "/app/ministerios" },
          { label: ministerio.nome, href: `/app/ministerios/${ministerio.id}` },
          { label: "Editar" },
        ]}
      />

      {/* Header */}
      <Form method="post" noValidate>
        <input type="hidden" name="intent" value="update" />
        <input type="hidden" name="diasEncontro" value={diasSelecionados.join(",")} />
        <input type="hidden" name="corDestaque" value={corDestaque} />
        {liderSelecionado && (
          <>
            <input type="hidden" name="liderNome" value={liderSelecionado.nome} />
            <input type="hidden" name="liderId" value={liderSelecionado.id} />
          </>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mt-3 mb-6">
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Editar Ministério
          </h1>
          <div className="flex items-center gap-2 shrink-0">
            <Link to="/app/ministerios">
              <Button type="button" variant="secondary" size="sm">
                Cancelar
              </Button>
            </Link>
            <Button type="submit" variant="blue" size="sm" loading={isSubmitting}>
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
              </svg>
              {isSubmitting ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </div>
        </div>

        {/* ── Card: Informações Básicas ── */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-5 mb-5">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-base font-extrabold text-slate-900">Informações Básicas</h2>
          </div>

          <Input
            id="nome"
            name="nome"
            label="Nome do Ministério"
            required
            maxLength={80}
            defaultValue={ministerio.nome}
            error={fieldErrors?.nome}
            placeholder="Ex: Louvor e Adoração"
          />

          <div>
            <label htmlFor="descricao" className="block text-sm font-medium text-slate-700 mb-1">
              Descrição
            </label>
            <textarea
              id="descricao"
              name="descricao"
              rows={3}
              maxLength={500}
              defaultValue={ministerio.descricao ?? ""}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-700 focus:border-transparent resize-none text-slate-900 placeholder:text-slate-400 text-sm"
              placeholder="Responsável pela música, som e ambientação..."
            />
          </div>

          {/* Status + Cor */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              name="status"
              label="Status"
              defaultValue={ministerio.status ?? "ATIVO"}
              options={STATUS_OPTIONS}
            />
            <div className="space-y-1">
              <p className="text-sm font-medium text-slate-700">Cor de Identificação</p>
              <div className="flex items-center gap-3 h-11 px-3 border border-slate-300 rounded-md bg-white">
                {/* Swatch */}
                <div
                  className="h-6 w-6 rounded border border-slate-200 shrink-0 relative"
                  style={{ backgroundColor: corDestaque }}
                >
                  <input
                    type="color"
                    value={corDestaque}
                    onChange={(e) => setCorDestaque(e.target.value)}
                    className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                    title="Escolher cor"
                  />
                </div>
                <span className="text-sm text-slate-700 font-medium flex-1">
                  Azul ({corDestaque.toUpperCase()})
                </span>
                {/* Paleta rápida */}
                <div className="flex items-center gap-1.5">
                  {PALETTE.slice(0, 4).map((cor) => (
                    <button
                      key={cor}
                      type="button"
                      onClick={() => setCorDestaque(cor)}
                      className="h-4 w-4 rounded-full border border-white shadow-sm transition-transform hover:scale-125"
                      style={{
                        backgroundColor: cor,
                        outline: corDestaque === cor ? `2px solid ${cor}` : "none",
                        outlineOffset: "1px",
                      }}
                      aria-label={`Cor ${cor}`}
                    />
                  ))}
                </div>
                {/* Ícone de editar cor */}
                <button
                  type="button"
                  className="text-slate-400 hover:text-slate-600 relative"
                  aria-label="Editar cor"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                  <input
                    type="color"
                    value={corDestaque}
                    onChange={(e) => setCorDestaque(e.target.value)}
                    className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                  />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── Card: Detalhes Operacionais ── */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-5 mb-5">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <h2 className="text-base font-extrabold text-slate-900">Detalhes Operacionais</h2>
          </div>

          {/* Líder + Capacidade */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Líder do Ministério */}
            <div className="space-y-1">
              <label className="block text-sm font-medium text-slate-700">
                Líder do Ministério
              </label>
              {liderSelecionado ? (
                <div className="flex items-center gap-2 h-11 px-3 border border-slate-300 rounded-md bg-white">
                  <div className="h-6 w-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center shrink-0">
                    {liderSelecionado.nome.charAt(0)}
                  </div>
                  <span className="text-sm text-slate-900 flex-1 truncate">
                    {liderSelecionado.nome}
                  </span>
                  <button
                    type="button"
                    onClick={() => setLiderSelecionado(null)}
                    className="text-slate-400 hover:text-slate-600"
                    aria-label="Remover líder"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Buscar membro..."
                    value={liderNome}
                    onChange={(e) => { setLiderNome(e.target.value); setShowLiderDropdown(true); }}
                    onFocus={() => setShowLiderDropdown(true)}
                    onBlur={() => setTimeout(() => setShowLiderDropdown(false), 150)}
                    className="w-full h-11 px-3 border border-slate-300 rounded-md text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-700"
                  />
                  {showLiderDropdown && liderNome && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                      {membrosDisponiveis
                        .filter((m) => m.nome.toLowerCase().includes(liderNome.toLowerCase()))
                        .map((m) => (
                          <button
                            key={m.id}
                            type="button"
                            className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                            onMouseDown={() => {
                              setLiderSelecionado(m);
                              setLiderNome("");
                              setShowLiderDropdown(false);
                            }}
                          >
                            <div className="h-6 w-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center shrink-0">
                              {m.nome.charAt(0)}
                            </div>
                            <span className="truncate">{m.nome}</span>
                          </button>
                        ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Capacidade */}
            <div className="space-y-1">
              <label htmlFor="capacidadeMaxima" className="block text-sm font-medium text-slate-700">
                Capacidade
              </label>
              <input
                id="capacidadeMaxima"
                name="capacidadeMaxima"
                type="number"
                min={1}
                placeholder="Ilimitado"
                defaultValue={ministerio.capacidadeMaxima ?? undefined}
                className="w-full h-11 px-3 rounded-md border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-700 text-sm"
              />
            </div>
          </div>

          {/* Dias de Atuação */}
          <div>
            <p className="text-sm font-medium text-slate-700 mb-2">Dias de Atuação</p>
            <div className="flex items-center gap-2 flex-wrap">
              {DIAS_SEMANA.map((dia) => {
                const ativo = diasSelecionados.includes(dia.key);
                return (
                  <button
                    key={dia.key}
                    type="button"
                    onClick={() => toggleDia(dia.key)}
                    className={
                      ativo
                        ? "px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors bg-blue-50 text-blue-700 border-blue-300"
                        : "px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors bg-white text-slate-600 border-slate-300 hover:border-blue-300 hover:text-blue-600"
                    }
                  >
                    {dia.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Horário + Turno */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              id="horarioPadrao"
              name="horarioPadrao"
              label="Horário Padrão"
              placeholder="19:30"
              defaultValue={ministerio.horarioPadrao ?? "19:30"}
            />
            <Select
              name="turnoPrincipal"
              label="Turno"
              defaultValue={ministerio.turnoPrincipal ?? "NOITE"}
              options={TURNO_OPTIONS}
            />
          </div>
        </div>
      </Form>

      {/* ── Gerar Escalas do Mês ── */}
      {canEdit && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs mb-5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1">
              <h2 className="text-base font-extrabold text-slate-900 mb-1">Gerar Escalas do Mês</h2>
              <ul className="space-y-1 text-xs text-slate-600">
                <li><strong>O que faz:</strong> cria escalas para todos os cultos e ensaios do mês atual deste ministério.</li>
                <li><strong>Como funciona:</strong> para cada atividade, o sistema sorteia um membro disponível para cada função cadastrada, tentando não repetir o mesmo membro em datas consecutivas.</li>
                <li><strong>Depois de gerar:</strong> as escalas ficam marcadas com badge "Auto" e podem ser editadas manualmente (trocar, adicionar ou remover voluntários).</li>
                <li><strong>Re-gerar:</strong> se você gerar novamente, apenas as escalas automáticas do mês são substituídas. Escalas editadas manualmente são preservadas.</li>
              </ul>
            </div>
            <fetcher.Form method="post" className="shrink-0">
              <input type="hidden" name="intent" value="gerar-escalas" />
              <Button
                type="submit"
                variant="blue"
                size="sm"
                loading={fetcher.state === "submitting"}
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Gerar
              </Button>
            </fetcher.Form>
          </div>
        </div>
      )}

      {/* ── Card: Funções do Ministério ── */}
      {canEdit && (
        <div className="mb-5">
          <GerenciarFuncoes
            ministerioId={ministerio.id}
            funcoes={funcoes}
            canEdit={canEdit}
          />
        </div>
      )}

      {/* ── Card: Membros do Ministério ── (form separado por membro) */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <h2 className="text-base font-extrabold text-slate-900">Membros do Ministério</h2>
          </div>
          {canEdit && (
            <button
              type="button"
              onClick={() => setShowAddMembro(!showAddMembro)}
              className="flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Adicionar Membro
            </button>
          )}
        </div>

        {/* Formulário de adicionar membro */}
        {showAddMembro && canEdit && (
          <div className="px-6 py-4 bg-slate-50 border-b border-slate-100">
            <Form method="post" className="flex items-end gap-3">
              <input type="hidden" name="intent" value="add-membro" />
              <div className="flex-1 space-y-1">
                <label htmlFor="membroBusca" className="block text-xs font-medium text-slate-600">
                  Selecionar membro
                </label>
                <div className="relative">
                  <input
                    id="membroBusca"
                    type="text"
                    placeholder="Buscar por nome..."
                    value={membroBusca}
                    onChange={(e) => setMembroBusca(e.target.value)}
                    className="w-full h-9 px-3 border border-slate-300 rounded-md text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-700"
                  />
                </div>
                {membroBusca && membrosDisponiveisFiltrados.length > 0 && (
                  <div className="absolute z-10 w-64 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                    {membrosDisponiveisFiltrados.map((m) => (
                      <button
                        key={m.id}
                        type="submit"
                        name="membroId"
                        value={m.id}
                        className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                      >
                        <div className="h-6 w-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center shrink-0">
                          {m.nome.charAt(0)}
                        </div>
                        <span className="truncate">{m.nome}</span>
                      </button>
                    ))}
                  </div>
                )}
                {membroBusca && membrosDisponiveisFiltrados.length === 0 && (
                  <p className="text-xs text-slate-400 mt-1">Nenhum membro encontrado.</p>
                )}
              </div>
              <Button type="button" variant="secondary" size="sm" onClick={() => { setShowAddMembro(false); setMembroBusca(""); }}>
                Cancelar
              </Button>
            </Form>
          </div>
        )}

        {/* Tabela de membros */}
        {membros.length === 0 ? (
          <div className="px-6 py-8">
            <ErrorAlert tone="info">
              Nenhum membro vinculado. Clique em &quot;+ Adicionar Membro&quot; para vincular.
            </ErrorAlert>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Membro
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Cargo
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Função
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Status
                  </th>
                  {canEdit && (
                    <th className="text-right px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Ações
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {membros.map((membro) => (
                  <tr key={membro.vinculoId} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-100 to-indigo-200 text-blue-800 text-sm font-bold flex items-center justify-center shrink-0">
                          {membro.nome.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-semibold text-slate-900">{membro.nome}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      <span>{membro.cargo ?? tipoLabel(membro.tipo)}</span>
                      {membro.lider && (
                        <span className="ml-2 text-xs font-semibold text-amber-700">Líder</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {canEdit ? (
                        <Form method="post" className="inline">
                          <input type="hidden" name="intent" value="atribuir-funcao" />
                          <input type="hidden" name="vinculoId" value={membro.vinculoId} />
                          <select
                            name="funcaoId"
                            defaultValue={membro.funcaoId ?? ""}
                            onChange={(e) => e.currentTarget.form?.submit()}
                            className="h-8 px-2 border border-slate-300 rounded-md text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-700"
                          >
                            <option value="">—</option>
                            {funcoes.map((f) => (
                              <option key={f.id} value={f.id}>{f.nome}</option>
                            ))}
                          </select>
                        </Form>
                      ) : (
                        <span className="text-slate-600">{membro.funcaoNome ?? "—"}</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Ativo
                      </span>
                    </td>
                    {canEdit && (
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          {/* Disponibilidade */}
                          <button
                            type="button"
                            onClick={() => setMembroDisponibilidade({ id: membro.membroId, nome: membro.nome })}
                            className="p-1.5 text-slate-400 hover:text-cyan-600 rounded-md hover:bg-cyan-50 transition-colors"
                            aria-label={`Gerenciar disponibilidade de ${membro.nome}`}
                            title="Disponibilidade"
                          >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          </button>
                          <Form method="post">
                            <input type="hidden" name="intent" value="toggle-lider" />
                            <input type="hidden" name="membroId" value={membro.membroId} />
                            <button
                              type="submit"
                              className="p-1.5 text-slate-400 hover:text-amber-600 rounded-md hover:bg-amber-50 transition-colors"
                              aria-label={membro.lider ? `Remover ${membro.nome} como líder` : `Definir ${membro.nome} como líder`}
                              title={membro.lider ? "Remover liderança" : "Definir como líder"}
                            >
                              <svg className="h-4 w-4" fill={membro.lider ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                              </svg>
                            </button>
                          </Form>
                          {/* Desvincular */}
                          <Form method="post">
                            <input type="hidden" name="intent" value="remove-membro" />
                            <input type="hidden" name="membroId" value={membro.membroId} />
                            <button
                              type="submit"
                              className="p-1.5 text-slate-400 hover:text-red-600 rounded-md hover:bg-red-50 transition-colors"
                              aria-label="Remover membro"
                            >
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </Form>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Modal de Disponibilidade ── */}
      {membroDisponibilidade && (
        <ModalDisponibilidade
          open={!!membroDisponibilidade}
          onClose={() => {
            setMembroDisponibilidade(null);
            setFormAtividade(null);
            setFormIndisponibilidade(null);
          }}
          nomeMembro={membroDisponibilidade.nome}
          atividades={atividades}
          indisponibilidades={[]}
          onAddAtividade={(data) => setFormAtividade({ data, tipo: "ENSAIO" })}
          onAddIndisponibilidade={(data) => setFormIndisponibilidade(data)}
          onRemoveAtividade={(id) => {
            fetcher.submit(
              { intent: "remove-atividade", atividadeId: id },
              { method: "post" },
            );
          }}
          onRemoveIndisponibilidade={(id) => {
            fetcher.submit(
              { intent: "remove-indisponibilidade", indisponibilidadeId: id },
              { method: "post" },
            );
          }}
        />
      )}

      {/* ── Formulário de atividade (ensaio/extra) ── */}
      {formAtividade && membroDisponibilidade && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setFormAtividade(null)}>
          <div className="bg-white rounded-xl shadow-lg p-5 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-bold text-slate-900 mb-3">Nova Atividade</h3>
            <fetcher.Form method="post" className="space-y-3">
              <input type="hidden" name="intent" value="add-atividade" />
              <input type="hidden" name="data" value={formAtividade.data} />
              <input type="hidden" name="membroId" value={membroDisponibilidade.id} />
              <div className="space-y-1">
                <label className="block text-xs font-medium text-slate-600">Tipo</label>
                <select
                  name="tipo"
                  defaultValue={formAtividade.tipo}
                  className="w-full h-9 px-3 border border-slate-300 rounded-md text-sm"
                >
                  <option value="ENSAIO">Ensaio</option>
                  <option value="ATIVIDADE_EXTRA">Atividade Extra</option>
                </select>
              </div>
              <Input name="horario" label="Horário" placeholder="19:30" defaultValue="19:30" />
              <Input name="descricao" label="Descrição (opcional)" placeholder="Ex: Ensaio extra para o culto de domingo" />
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="secondary" size="sm" onClick={() => setFormAtividade(null)}>Cancelar</Button>
                <Button type="submit" variant="blue" size="sm" loading={fetcher.state === "submitting"}>Adicionar</Button>
              </div>
            </fetcher.Form>
          </div>
        </div>
      )}

      {/* ── Formulário de indisponibilidade ── */}
      {formIndisponibilidade && membroDisponibilidade && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setFormIndisponibilidade(null)}>
          <div className="bg-white rounded-xl shadow-lg p-5 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-bold text-slate-900 mb-3">Marcar Indisponibilidade</h3>
            <fetcher.Form method="post" className="space-y-3">
              <input type="hidden" name="intent" value="add-indisponibilidade" />
              <input type="hidden" name="membroId" value={membroDisponibilidade.id} />
              <Input name="dataInicio" type="date" label="Data início" defaultValue={formIndisponibilidade} />
              <Input name="dataFim" type="date" label="Data fim" defaultValue={formIndisponibilidade} />
              <Input name="motivo" label="Motivo (opcional)" placeholder="Ex: Viagem, consulta médica..." />
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="secondary" size="sm" onClick={() => setFormIndisponibilidade(null)}>Cancelar</Button>
                <Button type="submit" variant="blue" size="sm" loading={fetcher.state === "submitting"}>Marcar</Button>
              </div>
            </fetcher.Form>
          </div>
        </div>
      )}
    </div>
  );
}
