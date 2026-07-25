/**
 * Rota /app/escalas/novo — criar nova escala de voluntários.
 * Regra de negócio integrada com Cultos, Eventos e dados do Ministério.
 */
import { useState, useRef, useEffect } from "react";
import { Form, Link, useNavigation, redirect, data } from "react-router";
import type { Route } from "./+types/escalas.novo";
import { userContext } from "~/lib/user-context";
import { criarEscala, adicionarVoluntario } from "~/lib/escalas.server";
import type { CriarEscalaInput } from "~/lib/escalas.server";
import { prisma } from "~/db/prisma.server";
import { z } from "zod";
import { Button } from "~/components/Button";
import { Input } from "~/components/Input";
import { Select } from "~/components/Select";
import { Breadcrumb } from "~/components/Breadcrumb";

/** Cargos autorizados a gerenciar escalas. */
const CAN_MANAGE = ["ADMIN", "PASTOR", "SECRETARIO", "LIDER_MINISTERIO"] as const;

const escalaSchema = z.object({
  ministerioId: z.string().min(1, "Ministério é obrigatório"),
  culto: z.string().min(1, "Título da escala é obrigatório"),
  data: z.string().min(1, "Data é obrigatória"),
  voluntarios: z.string().optional(),
  cultoId: z.string().optional(),
  eventoId: z.string().optional(),
});

function formatIsoDate(dateVal: Date | string): string {
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return "";
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Loader: carrega ministérios ativos (com funções/membros), cultos, eventos e todos os membros de fallback.
 */
export async function loader({ context }: Route.LoaderArgs) {
  const user = context.get(userContext);
  if (!user) {
    throw new Response("Não autenticado.", { status: 401 });
  }

  const canEdit = user.cargo != null && (CAN_MANAGE as readonly string[]).includes(user.cargo);
  if (!canEdit) {
    throw new Response("Sem permissão para criar escalas.", { status: 403 });
  }

  const [ministerios, membros, cultos, eventos] = await Promise.all([
    prisma.ministerio.findMany({
      where: { status: "ATIVO" },
      include: {
        funcoes: {
          select: { id: true, nome: true },
          orderBy: { nome: "asc" },
        },
        membros: {
          include: {
            membro: {
              select: { id: true, nome: true },
            },
            funcao: {
              select: { id: true, nome: true },
            },
          },
        },
      },
      orderBy: { nome: "asc" },
    }).catch(() => []),
    prisma.membro.findMany({
      select: { id: true, nome: true },
      orderBy: { nome: "asc" },
      take: 200,
    }).catch(() => []),
    prisma.culto.findMany({
      where: {
        status: { in: ["AGENDADO", "CONFIRMADO"] },
      },
      orderBy: { data: "asc" },
      take: 100,
    }).catch(() => []),
    prisma.evento.findMany({
      where: {
        status: { in: ["RASCUNHO", "PUBLICADO"] },
      },
      orderBy: { dataInicio: "asc" },
      take: 100,
    }).catch(() => []),
  ]);

  return { canEdit, ministerios, membros, cultos, eventos };
}

/**
 * Action: cria escala vinculada a culto/evento e adiciona voluntários.
 */
export async function action({ request, context }: Route.ActionArgs) {
  const user = context.get(userContext);
  if (!user) {
    throw new Response("Não autenticado.", { status: 401 });
  }

  const canEdit = user.cargo != null && (CAN_MANAGE as readonly string[]).includes(user.cargo);
  if (!canEdit) {
    throw new Response("Sem permissão para criar escalas.", { status: 403 });
  }

  const formData = Object.fromEntries(await request.formData());
  const parsed = escalaSchema.safeParse(formData);

  if (!parsed.success) {
    return data({ errors: parsed.error.flatten().fieldErrors }, { status: 422 });
  }

  const input: CriarEscalaInput = {
    ministerioId: parsed.data.ministerioId,
    titulo: parsed.data.culto,
    data: parsed.data.data,
    cultoId: parsed.data.cultoId || undefined,
    eventoId: parsed.data.eventoId || undefined,
  };

  const escala = await criarEscala(input, user);

  // Vincula voluntários se houver
  let voluntarios: Array<{ membroId: string; funcao: string }> = [];
  try {
    voluntarios = JSON.parse(parsed.data.voluntarios ?? "[]");
  } catch {
    voluntarios = [];
  }

  for (const v of voluntarios) {
    if (v.membroId && v.funcao) {
      await adicionarVoluntario(escala.id, { membroId: v.membroId, funcao: v.funcao }, user);
    }
  }

  return redirect("/app/escalas");
}

export default function NovaEscala({ loaderData }: Route.ComponentProps) {
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const { ministerios, membros, cultos, eventos } = loaderData;

  // Estados dos inputs de dados da Escala
  const [tipoVinculo, setTipoVinculo] = useState<"culto" | "evento" | "livre">("livre");
  const [ministerioId, setMinisterioId] = useState("");
  const [cultoId, setCultoId] = useState("");
  const [eventoId, setEventoId] = useState("");
  const [dataEscala, setDataEscala] = useState("");
  const [tituloEscala, setTituloEscala] = useState("");

  // Estado dos voluntários escalados
  const [voluntarios, setVoluntarios] = useState<Array<{
    id: string;
    membroId: string;
    nome: string;
    funcao: string;
  }>>([]);

  // Seletor para mostrar todos os membros da igreja
  const [mostrarTodosMembros, setMostrarTodosMembros] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fecha o dropdown se clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Encontra o ministério ativo atualmente selecionado
  const ministerioAtivo = ministerios.find((m) => m.id === ministerioId);

  // Filtra as funções configuradas no ministério selecionado
  const funcoesDoMinisterio = ministerioAtivo?.funcoes ?? [];

  // Lista padrão de funções de fallback (se o ministério não tiver funções cadastradas)
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
    ? funcoesDoMinisterio.map((f) => f.nome) 
    : funcoesPadraoFallback;

  // Membros vinculados ao ministério selecionado
  const membrosDoMinisterio = ministerioAtivo
    ? ministerioAtivo.membros.map((mm) => ({
        id: mm.membro.id,
        nome: mm.membro.nome,
        funcaoPadrao: mm.funcao?.nome || "",
      }))
    : [];

  // Define qual array de membros utilizar para busca
  const poolMembros = mostrarTodosMembros 
    ? membros.map((m) => ({ id: m.id, nome: m.nome, funcaoPadrao: "" })) 
    : membrosDoMinisterio;

  const filteredMembers = poolMembros.filter(
    (m) =>
      m.nome.toLowerCase().includes(searchTerm.toLowerCase()) &&
      !voluntarios.some((v) => v.membroId === m.id)
  );

  // Ao mudar de ministério, limpa voluntários escalados
  function handleMinisterioChange(id: string) {
    setMinisterioId(id);
    setVoluntarios([]);
  }

  // Lógica ao selecionar um Culto
  function handleCultoChange(cId: string) {
    setCultoId(cId);
    setEventoId("");
    const culto = cultos.find((c) => c.id === cId);
    if (culto) {
      setDataEscala(formatIsoDate(culto.data));
      setTituloEscala(culto.titulo);
    } else {
      setDataEscala("");
      setTituloEscala("");
    }
  }

  // Lógica ao selecionar um Evento
  function handleEventoChange(eId: string) {
    setEventoId(eId);
    setCultoId("");
    const evento = eventos.find((e) => e.id === eId);
    if (evento) {
      setDataEscala(formatIsoDate(evento.dataInicio));
      setTituloEscala(evento.titulo);
    } else {
      setDataEscala("");
      setTituloEscala("");
    }
  }

  function handleFocusSearch() {
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
    setShowDropdown(true);
  }

  function addVolunteer(member: { id: string; nome: string; funcaoPadrao: string }) {
    if (voluntarios.some((v) => v.membroId === member.id)) {
      setSearchTerm("");
      setShowDropdown(false);
      return;
    }

    // Define a função inicial: a função padrão do membro no ministério, a primeira cadastrada ou "Apoio"
    const funcaoInicial = member.funcaoPadrao || (funcoesDisponiveis[0] || "Apoio");

    setVoluntarios((prev) => [
      ...prev,
      {
        id: Math.random().toString(36).substring(7),
        membroId: member.id,
        nome: member.nome,
        funcao: funcaoInicial,
      },
    ]);
    setSearchTerm("");
    setShowDropdown(false);
  }

  function removeVolunteer(id: string) {
    setVoluntarios((prev) => prev.filter((v) => v.id !== id));
  }

  function updateFunction(id: string, newFuncao: string) {
    setVoluntarios((prev) =>
      prev.map((v) => (v.id === id ? { ...v, funcao: newFuncao } : v))
    );
  }

  const ministeriosOptions = ministerios.map((m) => ({
    value: m.id,
    label: m.nome,
  }));

  const cultosOptions = cultos.map((c) => ({
    value: c.id,
    label: `${c.titulo} - ${new Date(c.data).toLocaleDateString("pt-BR")} às ${c.horario}`,
  }));

  const eventosOptions = eventos.map((e) => ({
    value: e.id,
    label: `${e.titulo} - ${new Date(e.dataInicio).toLocaleDateString("pt-BR")}`,
  }));

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <Breadcrumb
        items={[
          { label: "Escalas", href: "/app/escalas" },
          { label: "Nova Escala" },
        ]}
      />

      <Form method="post" noValidate className="space-y-6">
        <input type="hidden" name="voluntarios" value={JSON.stringify(voluntarios)} />
        <input type="hidden" name="cultoId" value={cultoId} />
        <input type="hidden" name="eventoId" value={eventoId} />

        {/* Page Header */}
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
              Nova Escala
            </h1>
            <p className="text-sm font-medium text-slate-500 mt-1">
              Configure os detalhes e monte a equipe para a nova escala de voluntários.
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <Button as={Link} to="/app/escalas" variant="secondary" className="whitespace-nowrap shrink-0">
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="blue"
              loading={isSubmitting}
              className="whitespace-nowrap shrink-0"
              disabled={!ministerioId || !tituloEscala || !dataEscala}
            >
              {isSubmitting ? "Salvando..." : "Salvar Escala"}
            </Button>
          </div>
        </div>

        {/* Card 1: Informações Gerais */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-5">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-base font-extrabold text-slate-900">Informações Gerais</h2>
          </div>

          {/* Selecionar Ministério */}
          <div>
            <Select
              name="ministerioId"
              label="Ministério"
              placeholder="Selecione um ministério..."
              required
              value={ministerioId}
              onChange={(e) => handleMinisterioChange(e.target.value)}
              options={ministeriosOptions}
            />
          </div>

          {/* Seleção do Tipo de Vínculo */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700">Origem da Escala (Vincular a)</label>
            <div className="grid grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => {
                  setTipoVinculo("livre");
                  setCultoId("");
                  setEventoId("");
                }}
                className={`py-2.5 px-4 rounded-xl border text-sm font-bold transition-all text-center ${
                  tipoVinculo === "livre"
                    ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                    : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                }`}
              >
                Avulsa / Livre
              </button>
              <button
                type="button"
                onClick={() => {
                  setTipoVinculo("culto");
                  setEventoId("");
                }}
                className={`py-2.5 px-4 rounded-xl border text-sm font-bold transition-all text-center ${
                  tipoVinculo === "culto"
                    ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                    : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                }`}
              >
                Culto Cadastrado
              </button>
              <button
                type="button"
                onClick={() => {
                  setTipoVinculo("evento");
                  setCultoId("");
                }}
                className={`py-2.5 px-4 rounded-xl border text-sm font-bold transition-all text-center ${
                  tipoVinculo === "evento"
                    ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                    : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                }`}
              >
                Evento Cadastrado
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            {/* Seletor dinâmico baseado no tipo de vínculo */}
            {tipoVinculo === "culto" && (
              <div className="md:col-span-2">
                <Select
                  name="selectCulto"
                  label="Selecionar Culto"
                  placeholder="Selecione um culto da lista..."
                  value={cultoId}
                  onChange={(e) => handleCultoChange(e.target.value)}
                  options={cultosOptions}
                />
              </div>
            )}

            {tipoVinculo === "evento" && (
              <div className="md:col-span-2">
                <Select
                  name="selectEvento"
                  label="Selecionar Evento"
                  placeholder="Selecione um evento da lista..."
                  value={eventoId}
                  onChange={(e) => handleEventoChange(e.target.value)}
                  options={eventosOptions}
                />
              </div>
            )}

            {/* Input Data da Escala */}
            <Input
              id="data"
              name="data"
              label="Data da Escala"
              type="date"
              required
              value={dataEscala}
              onChange={(e) => setDataEscala(e.target.value)}
              disabled={tipoVinculo !== "livre"}
            />

            {/* Input Título / Nome da Escala */}
            <div className="md:col-span-2">
              <Input
                id="culto"
                name="culto"
                label="Título da Escala (Culto/Evento)"
                placeholder="Ex: Culto de Celebração (Domingo 18h)"
                required
                value={tituloEscala}
                onChange={(e) => setTituloEscala(e.target.value)}
                disabled={tipoVinculo !== "livre"}
              />
            </div>
          </div>
        </div>

        {/* Card 2: Voluntários */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h2 className="text-base font-extrabold text-slate-900">Voluntários</h2>
            </div>
            <button
              type="button"
              onClick={handleFocusSearch}
              className="text-blue-600 hover:text-blue-700 font-semibold text-sm transition-colors"
              disabled={!ministerioId}
            >
              + Adicionar Novo
            </button>
          </div>

          {!ministerioId ? (
            <div className="text-center py-6 text-slate-500 text-sm bg-slate-50 rounded-xl border border-dashed border-slate-200">
              Por favor, selecione um Ministério para começar a adicionar voluntários.
            </div>
          ) : (
            <>
              {/* Campo de Busca de Membros + Checkbox Fallback */}
              <div className="space-y-3">
                <div className="relative" ref={dropdownRef}>
                  <div className="relative">
                    <input
                      ref={searchInputRef}
                      type="text"
                      value={searchTerm}
                      onChange={(e) => {
                        setSearchTerm(e.target.value);
                        setShowDropdown(true);
                      }}
                      onFocus={() => setShowDropdown(true)}
                      placeholder={
                        mostrarTodosMembros
                          ? "Buscar em todos os membros cadastrados na igreja..."
                          : `Buscar voluntários vinculados ao Ministério de ${ministerioAtivo?.nome ?? ""}...`
                      }
                      className="w-full h-11 pl-10 pr-4 rounded-md border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-700 focus-visible:ring-offset-2"
                    />
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </span>
                  </div>

                  {/* Dropdown de Resultados da busca */}
                  {showDropdown && searchTerm.trim() !== "" && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {filteredMembers.length === 0 ? (
                        <div className="px-4 py-3 text-sm text-slate-500">Nenhum membro disponível encontrado.</div>
                      ) : (
                        filteredMembers.map((membro) => (
                          <button
                            key={membro.id}
                            type="button"
                            onClick={() => addVolunteer(membro)}
                            className="w-full text-left px-4 py-2.5 hover:bg-slate-50 text-sm font-medium text-slate-800 flex items-center justify-between border-b border-slate-50 last:border-0"
                          >
                            <div className="flex flex-col">
                              <span>{membro.nome}</span>
                              {membro.funcaoPadrao && (
                                <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">
                                  Função padrão: {membro.funcaoPadrao}
                                </span>
                              )}
                            </div>
                            <span className="text-xs text-blue-600 font-semibold">Adicionar</span>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="mostrarTodosMembros"
                    checked={mostrarTodosMembros}
                    onChange={(e) => setMostrarTodosMembros(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                  <label htmlFor="mostrarTodosMembros" className="text-xs font-semibold text-slate-500 select-none cursor-pointer">
                    Buscar voluntários de fora do Ministério (mostrar toda a lista da igreja)
                  </label>
                </div>
              </div>

              {/* Tabela de Voluntários */}
              <div className="overflow-x-auto border border-slate-100 rounded-xl">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="text-left px-5 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Membro</th>
                      <th className="text-left px-5 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Função</th>
                      <th className="text-right px-5 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {voluntarios.map((v) => {
                      const initials = v.nome
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .substring(0, 2)
                        .toUpperCase();
                      return (
                        <tr key={v.id} className="hover:bg-slate-50/50 transition-colors">
                          {/* Avatar + Nome */}
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-3">
                              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 text-white text-xs font-bold flex items-center justify-center shrink-0 shadow-xs">
                                  {initials}
                              </div>
                              <span className="font-semibold text-slate-900">{v.nome}</span>
                            </div>
                          </td>

                          {/* Select Função */}
                          <td className="px-5 py-3.5">
                            <div className="relative inline-block w-48">
                              <select
                                value={v.funcao}
                                onChange={(e) => updateFunction(v.id, e.target.value)}
                                className="w-full h-9 pl-3 pr-8 text-sm font-semibold text-slate-600 bg-slate-50 border border-slate-200 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 cursor-pointer appearance-none"
                              >
                                {funcoesDisponiveis.map((func) => (
                                  <option key={func} value={func}>{func}</option>
                                ))}
                                {!funcoesDisponiveis.includes(v.funcao) && (
                                  <option value={v.funcao}>{v.funcao}</option>
                                )}
                              </select>
                              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-400">
                                <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                                  <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
                                </svg>
                              </div>
                            </div>
                          </td>

                          {/* Ações */}
                          <td className="px-5 py-3.5 text-right">
                            <button
                              type="button"
                              onClick={() => removeVolunteer(v.id)}
                              className="text-red-500 hover:text-red-700 font-semibold text-xs transition-colors"
                            >
                              Remover
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {voluntarios.length === 0 && (
                      <tr>
                        <td colSpan={3} className="px-5 py-8 text-center text-slate-400 text-sm">
                          Nenhum voluntário adicionado. Use o campo de busca acima para incluir membros deste ministério.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* Card 3: Observações */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-5">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h7" />
              </svg>
            </div>
            <h2 className="text-base font-extrabold text-slate-900">Observações</h2>
          </div>

          <textarea
            name="observacoes"
            rows={4}
            className="w-full p-3 border border-slate-300 rounded-md bg-white text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-700 focus-visible:ring-offset-2 placeholder:text-slate-400 text-sm"
            placeholder="Adicione notas, instruções especiais ou detalhes do repertório..."
          />
        </div>
      </Form>
    </div>
  );
}
