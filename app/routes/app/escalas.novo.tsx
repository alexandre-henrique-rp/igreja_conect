/**
 * Rota /app/escalas/novo — criar nova escala de voluntários.
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
});

export function meta(_args: Route.MetaArgs) {
  return [{ title: "Nova Escala · Igreja Conect" }];
}

/**
 * Loader: carrega ministérios e membros.
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

  const [ministerios, membros] = await Promise.all([
    prisma.ministerio.findMany({
      select: { id: true, nome: true },
      orderBy: { nome: "asc" },
    }).catch(() => []),
    prisma.membro.findMany({
      select: { id: true, nome: true },
      orderBy: { nome: "asc" },
      take: 100,
    }).catch(() => []),
  ]);

  return { canEdit, ministerios, membros };
}

/**
 * Action: cria escala e vincula voluntários.
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
  const { ministerios, membros } = loaderData;

  // Estado dos voluntários - começa pré-populado como o mockup
  const [voluntarios, setVoluntarios] = useState<Array<{
    id: string;
    membroId: string;
    nome: string;
    funcao: string;
  }>>([
    { id: "1", membroId: "m1", nome: "João Silva", funcao: "Violão" },
    { id: "2", membroId: "m2", nome: "Maria Oliveira", funcao: "Vocal Principal" }
  ]);

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

  function handleFocusSearch() {
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
    setShowDropdown(true);
  }

  function addVolunteer(member: typeof membros[0]) {
    if (voluntarios.some((v) => v.membroId === member.id)) {
      setSearchTerm("");
      setShowDropdown(false);
      return;
    }
    setVoluntarios((prev) => [
      ...prev,
      {
        id: Math.random().toString(36).substring(7),
        membroId: member.id,
        nome: member.nome,
        funcao: "Apoio",
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

  const filteredMembers = membros.filter(
    (m) =>
      m.nome.toLowerCase().includes(searchTerm.toLowerCase()) &&
      !voluntarios.some((v) => v.membroId === m.id)
  );

  const ministeriosOptions = ministerios.map((m) => ({
    value: m.id,
    label: m.nome,
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

        {/* Page Header */}
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
              Nova Escala
            </h1>
            <p className="text-sm font-medium text-slate-500 mt-1">
              Preencha os detalhes para criar uma nova escala de voluntários.
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Select
              name="ministerioId"
              label="Ministério"
              placeholder="Selecione um ministério..."
              required
              options={ministeriosOptions}
            />

            <Input
              id="data"
              name="data"
              label="Data"
              type="date"
              required
              placeholder="dd/mm/aaaa"
            />

            <div className="md:col-span-2">
              <Input
                id="culto"
                name="culto"
                label="Culto/Evento"
                placeholder="Ex: Culto de Celebração (Domingo 18h)"
                required
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
            >
              + Adicionar Novo
            </button>
          </div>

          {/* Campo de Busca de Membros */}
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
                placeholder="Buscar membros pelo nome ou função..."
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
                      <span>{membro.nome}</span>
                      <span className="text-xs text-blue-600 font-semibold">Adicionar</span>
                    </button>
                  ))
                )}
              </div>
            )}
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
                            <option value="Violão">Violão</option>
                            <option value="Vocal Principal">Vocal Principal</option>
                            <option value="Backing Vocal">Backing Vocal</option>
                            <option value="Teclado">Teclado</option>
                            <option value="Bateria">Bateria</option>
                            <option value="Contrabaixo">Contrabaixo</option>
                            <option value="Guitarra">Guitarra</option>
                            <option value="Operador de Som">Operador de Som</option>
                            <option value="Projeção / Mídia">Projeção / Mídia</option>
                            <option value="Recepcionista">Recepcionista</option>
                            <option value="Líder de Equipe">Líder de Equipe</option>
                            <option value="Apoio">Apoio</option>
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
                      Nenhum voluntário adicionado. Use o campo de busca acima para incluir membros.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
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
