/**
 * Rota /app/ministerios/novo — criar novo ministério.
 */
import { useState } from "react";
import { Form, Link, useNavigation } from "react-router";
import type { Route } from "./+types/ministerios.novo";
import { userContext } from "~/lib/user-context";
import { prisma } from "~/db/prisma.server";
import { z } from "zod";
import { Button } from "~/components/Button";
import { Input } from "~/components/Input";
import { Select } from "~/components/Select";
import { NomeDuplicadoError, ConflictError } from "~/lib/errors";
import { createMinisterio, addMembroToMinisterio } from "~/lib/ministries.server";

/** Cargos que podem gerenciar ministérios. */
const CAN_MANAGE = ["ADMIN", "PASTOR", "SECRETARIO"] as const;

export function meta(_args: Route.MetaArgs) {
  return [{ title: "Novo Ministério · Igreja Conect" }];
}

/**
 * Schema de criação de ministério.
 */
const CreateSchema = z.object({
  nome: z.string().min(2, "Nome deve ter ao menos 2 caracteres.").max(80),
  descricao: z.string().max(500).optional(),
  status: z.enum(["ATIVO", "INATIVO", "SUSPENSO"]).optional(),
  capacidadeMaxima: z.string().optional(),
  diasEncontro: z.string().optional(),
  horarioPadrao: z.string().optional(),
  turnoPrincipal: z.enum(["MANHA", "TARDE", "NOITE"]).optional(),
  corDestaque: z.string().optional(),
  liderancaId: z.string().optional(),
});

/**
 * Loader: verifica permissões.
 */
export async function loader({ context }: Route.LoaderArgs) {
  const user = context.get(userContext);
  if (!user) {
    throw new Response("Não autenticado.", { status: 401 });
  }

  const canEdit = user.cargo != null && (CAN_MANAGE as readonly string[]).includes(user.cargo);
  if (!canEdit) {
    throw new Response("Sem permissão para criar ministérios.", { status: 403 });
  }

  // Busca membros disponíveis para seleção de liderança
  const membros = await prisma.membro.findMany({
    select: { id: true, nome: true },
    orderBy: { nome: "asc" },
    take: 50,
  });

  return { canEdit, membros };
}

/**
 * Action: cria novo ministério.
 */
export async function action({ context, request }: Route.ActionArgs) {
  const user = context.get(userContext);
  if (!user) {
    throw new Response("Não autenticado.", { status: 401 });
  }

  const canEdit = user.cargo != null && (CAN_MANAGE as readonly string[]).includes(user.cargo);
  if (!canEdit) {
    throw new Response("Sem permissão para criar ministérios.", { status: 403 });
  }

  const formData = await request.formData();
  const raw = {
    nome: String(formData.get("nome") ?? ""),
    descricao: formData.get("descricao")
      ? String(formData.get("descricao"))
      : undefined,
    status: formData.get("status") ? String(formData.get("status")) : undefined,
    capacidadeMaxima: formData.get("capacidadeMaxima")
      ? String(formData.get("capacidadeMaxima"))
      : undefined,
    diasEncontro: formData.get("diasEncontro")
      ? String(formData.get("diasEncontro"))
      : undefined,
    horarioPadrao: formData.get("horarioPadrao")
      ? String(formData.get("horarioPadrao"))
      : undefined,
    turnoPrincipal: formData.get("turnoPrincipal")
      ? String(formData.get("turnoPrincipal"))
      : undefined,
    corDestaque: formData.get("corDestaque")
      ? String(formData.get("corDestaque"))
      : undefined,
    liderancaId: formData.get("liderancaId")
      ? String(formData.get("liderancaId"))
      : undefined,
  };

  const parsed = CreateSchema.safeParse(raw);
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
    const created = await createMinisterio(
      {
        nome: parsed.data.nome,
        descricao: parsed.data.descricao,
        status: parsed.data.status as "ATIVO" | "INATIVO" | "SUSPENSO" | undefined,
        corDestaque: parsed.data.corDestaque,
        capacidadeMaxima: parsed.data.capacidadeMaxima
          ? Number(parsed.data.capacidadeMaxima)
          : undefined,
        diasEncontro: parsed.data.diasEncontro,
        horarioPadrao: parsed.data.horarioPadrao,
        turnoPrincipal: parsed.data.turnoPrincipal as "MANHA" | "TARDE" | "NOITE" | undefined,
      },
      user
    );

    // Se um líder foi selecionado, vincula ao ministério e marca como líder
    if (parsed.data.liderancaId) {
      try {
        await addMembroToMinisterio(created.id, parsed.data.liderancaId, user);
      } catch (e) {
        if (!(e instanceof ConflictError)) throw e;
      }
      await prisma.ministerioMembro.update({
        where: {
          membroId_ministerioId: {
            membroId: parsed.data.liderancaId,
            ministerioId: created.id,
          },
        },
        data: { lider: true },
      });
    }

    return new Response(null, { status: 302, headers: { Location: "/app/ministerios" } });
  } catch (e) {
    if (
      e &&
      typeof e === "object" &&
      "code" in e &&
      (e as { code: string }).code === "P2002"
    ) {
      throw new NomeDuplicadoError("Já existe um ministério com este nome.");
    }
    throw e;
  }
}

const DIAS_SEMANA = [
  { key: "D", label: "D", title: "Domingo" },
  { key: "S", label: "S", title: "Segunda" },
  { key: "T", label: "T", title: "Terça" },
  { key: "Q1", label: "Q", title: "Quarta" },
  { key: "Q2", label: "Q", title: "Quinta" },
  { key: "S2", label: "S", title: "Sábado" },
  { key: "S3", label: "S", title: "Sexta" },
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

export default function NovoMinisterio({ loaderData, actionData }: Route.ComponentProps) {
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const membros = loaderData?.membros ?? [];

  const [diasSelecionados, setDiasSelecionados] = useState<string[]>(["S", "Q1"]);
  const [corDestaque, setCorDestaque] = useState("#3B82F6");
  const [membroBusca, setMembroBusca] = useState("");
  const [membroSelecionado, setMembroSelecionado] = useState<{ id: string; nome: string } | null>(null);
  const [showMembroDropdown, setShowMembroDropdown] = useState(false);

  const membrosFiltrados = membros.filter((m) =>
    m.nome.toLowerCase().includes(membroBusca.toLowerCase())
  );

  function toggleDia(key: string) {
    setDiasSelecionados((prev) =>
      prev.includes(key) ? prev.filter((d) => d !== key) : [...prev, key]
    );
  }

  const fieldErrors = (actionData as { fieldErrors?: Record<string, string> } | undefined)?.fieldErrors;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <Form method="post" noValidate>
        {/* Hidden fields para dados extra */}
        <input type="hidden" name="diasEncontro" value={diasSelecionados.join(",")} />
        <input type="hidden" name="corDestaque" value={corDestaque} />
        {membroSelecionado && (
          <input type="hidden" name="liderancaId" value={membroSelecionado.id} />
        )}

        {/* Page Header */}
        <div className="flex items-start justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
              Novo Ministério
            </h1>
            <p className="text-sm font-medium text-slate-500 mt-1">
              Configure os detalhes para estruturar um novo ministério na igreja.
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <Link to="/app/ministerios">
              <Button type="button" variant="secondary">
                Cancelar
              </Button>
            </Link>
            <Button
              type="submit"
              variant="blue"
              loading={isSubmitting}
              className="whitespace-nowrap"
            >
              {isSubmitting ? "Salvando..." : "Salvar Ministério"}
            </Button>
          </div>
        </div>

        {/* Grid Layout: 2/3 + 1/3 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

          {/* ─── Coluna Esquerda (2/3) ─── */}
          <div className="lg:col-span-2 space-y-6">

            {/* Card: Dados Principais */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-5">
              <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                <div className="p-2 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <h2 className="text-base font-extrabold text-slate-900">Dados Principais</h2>
              </div>

              <Input
                id="nome"
                name="nome"
                label="Nome do Ministério"
                required
                maxLength={80}
                error={fieldErrors?.nome}
                placeholder="Ex: Louvor e Adoração"
                autoFocus
              />

              <div>
                <label htmlFor="descricao" className="block text-sm font-medium text-slate-700 mb-1">
                  Descrição / Objetivo
                </label>
                <textarea
                  id="descricao"
                  name="descricao"
                  rows={4}
                  maxLength={500}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-700 focus:border-transparent resize-none text-slate-900 placeholder:text-slate-400 text-sm"
                  placeholder="Qual o propósito principal deste ministério?"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Select
                  name="status"
                  label="Status Inicial"
                  defaultValue="ATIVO"
                  options={STATUS_OPTIONS}
                />
                <div className="space-y-1">
                  <label htmlFor="capacidadeMaxima" className="block text-sm font-medium text-slate-700">
                    Capacidade Máxima (Membros)
                  </label>
                  <input
                    id="capacidadeMaxima"
                    name="capacidadeMaxima"
                    type="number"
                    min={1}
                    placeholder="Ilimitado"
                    className="w-full h-11 px-3 rounded-md border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-700 focus:ring-offset-2 text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Card: Reuniões Oficiais */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-5">
              <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                </div>
                <h2 className="text-base font-extrabold text-slate-900">Reuniões Oficiais</h2>
              </div>

              {/* Dias de Encontro */}
              <div>
                <p className="text-sm font-medium text-slate-700 mb-3">Dias de Encontro</p>
                <div className="flex items-center gap-2 flex-wrap">
                  {DIAS_SEMANA.map((dia) => {
                    const ativo = diasSelecionados.includes(dia.key);
                    return (
                      <button
                        key={dia.key}
                        type="button"
                        title={dia.title}
                        onClick={() => toggleDia(dia.key)}
                        className={
                          ativo
                            ? "h-10 w-10 rounded-full text-sm font-bold transition-colors bg-blue-600 text-white border border-blue-700 shadow-sm"
                            : "h-10 w-10 rounded-full text-sm font-bold transition-colors bg-white text-slate-600 border border-slate-300 hover:border-blue-400 hover:text-blue-600"
                        }
                      >
                        {dia.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Horário e Turno */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  id="horarioPadrao"
                  name="horarioPadrao"
                  label="Horário Padrão"
                  type="text"
                  placeholder="Ex: 19:30"
                  defaultValue="19:30"
                />
                <Select
                  name="turnoPrincipal"
                  label="Turno Principal"
                  defaultValue="NOITE"
                  options={TURNO_OPTIONS}
                />
              </div>
            </div>
          </div>

          {/* ─── Coluna Direita (1/3) ─── */}
          <div className="space-y-6">

            {/* Card: Liderança */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
              <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
                    <circle cx="12" cy="9" r="2.5" />
                  </svg>
                </div>
                <h2 className="text-base font-extrabold text-slate-900">Liderança</h2>
              </div>

              {/* Busca de membro */}
              <div className="relative">
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </span>
                  <input
                    type="text"
                    placeholder="Buscar membro por nome..."
                    value={membroBusca}
                    onChange={(e) => {
                      setMembroBusca(e.target.value);
                      setShowMembroDropdown(true);
                    }}
                    onFocus={() => setShowMembroDropdown(true)}
                    onBlur={() => setTimeout(() => setShowMembroDropdown(false), 150)}
                    className="w-full h-10 pl-9 pr-3 rounded-md border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-700 focus:ring-offset-2"
                  />
                </div>

                {/* Dropdown de membros */}
                {showMembroDropdown && membroBusca && membrosFiltrados.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {membrosFiltrados.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                        onMouseDown={() => {
                          setMembroSelecionado(m);
                          setMembroBusca("");
                          setShowMembroDropdown(false);
                        }}
                      >
                        <div className="h-7 w-7 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center shrink-0">
                          {m.nome.charAt(0).toUpperCase()}
                        </div>
                        <span className="truncate">{m.nome}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Membro selecionado */}
              {membroSelecionado ? (
                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="h-9 w-9 rounded-full bg-blue-200 text-blue-800 text-sm font-bold flex items-center justify-center shrink-0 overflow-hidden">
                    {membroSelecionado.nome.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">{membroSelecionado.nome}</p>
                    <p className="text-xs text-slate-500">Membro</p>
                  </div>
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-blue-100 text-blue-700 border border-blue-200">
                    Líder Selecionado
                  </span>
                  <button
                    type="button"
                    onClick={() => setMembroSelecionado(null)}
                    className="text-slate-400 hover:text-slate-600 shrink-0 ml-1"
                    aria-label="Remover líder"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ) : (
                <p className="text-xs text-slate-400 text-center py-2">
                  Nenhum líder selecionado
                </p>
              )}
            </div>

            {/* Card: Identidade Visual */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
              <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                <div className="p-2 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                    <circle cx="13.5" cy="6.5" r=".5" />
                    <circle cx="17.5" cy="10.5" r=".5" />
                    <circle cx="8.5" cy="7.5" r=".5" />
                    <circle cx="6.5" cy="12.5" r=".5" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 011.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" />
                  </svg>
                </div>
                <h2 className="text-base font-extrabold text-slate-900">Identidade Visual</h2>
              </div>

              <div>
                <p className="text-sm font-medium text-slate-700 mb-3">Cor de Destaque no Sistema</p>
                <div className="flex items-center gap-3">
                  {/* Swatch preview grande */}
                  <div
                    className="h-12 w-12 rounded-lg border border-slate-200 shadow-sm shrink-0 cursor-pointer overflow-hidden relative"
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
                  <div className="flex-1">
                    <p className="text-sm font-bold text-slate-800">{corDestaque.toUpperCase()}</p>
                    <p className="text-xs text-slate-500">Usada em gráficos e agendas.</p>
                  </div>
                  {/* Color picker visual */}
                  <div
                    className="h-8 w-8 rounded-full border-2 border-white shadow-md cursor-pointer relative shrink-0"
                    style={{ backgroundColor: corDestaque }}
                  >
                    <input
                      type="color"
                      value={corDestaque}
                      onChange={(e) => setCorDestaque(e.target.value)}
                      className="absolute inset-0 opacity-0 w-full h-full cursor-pointer rounded-full"
                      title="Escolher cor"
                    />
                  </div>
                </div>
              </div>

              {/* Palette de cores rápidas */}
              <div>
                <p className="text-xs text-slate-500 mb-2">Cores sugeridas</p>
                <div className="flex items-center gap-2 flex-wrap">
                  {[
                    "#3B82F6", "#8B5CF6", "#EC4899", "#EF4444",
                    "#F59E0B", "#10B981", "#06B6D4", "#6366F1",
                  ].map((cor) => (
                    <button
                      key={cor}
                      type="button"
                      onClick={() => setCorDestaque(cor)}
                      className="h-7 w-7 rounded-full border-2 transition-all hover:scale-110"
                      style={{
                        backgroundColor: cor,
                        borderColor: corDestaque === cor ? "#1e293b" : "transparent",
                        boxShadow: corDestaque === cor ? `0 0 0 2px white, 0 0 0 3px ${cor}` : "none",
                      }}
                      title={cor}
                      aria-label={`Cor ${cor}`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

      </Form>
    </div>
  );
}
