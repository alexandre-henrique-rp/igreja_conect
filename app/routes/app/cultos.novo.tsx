/**
 * Rota /app/cultos/novo — criar novo culto ou programação (com suporte a recorrência, preletor inteligente e ministério).
 */
import { useState } from "react";
import { Form, Link, useNavigation, redirect, data } from "react-router";
import type { Route } from "./+types/cultos.novo";
import { userContext } from "~/lib/user-context";
import { criarCulto } from "~/lib/cultos.server";
import type { CriarCultoInput } from "~/lib/cultos.server";
import { prisma } from "~/db/prisma.server";
import { z } from "zod";
import { Button } from "~/components/Button";
import { Input } from "~/components/Input";
import { Select } from "~/components/Select";
import { Breadcrumb } from "~/components/Breadcrumb";

const cultoSchema = z.object({
  nome: z.string().min(1, "Nome do culto é obrigatório"),
  data: z.string().min(1, "Data é obrigatória"),
  horario: z.string().min(1, "Horário é obrigatório"),
  tipo: z.enum(["Presencial", "Online", "Híbrido"]),
  status: z.enum(["Agendado", "Confirmado", "Pendente"]),
  preletorOpcao: z.string().optional(),
  preletorOutro: z.string().optional(),
  ministerioId: z.string().optional(),
  recorrente: z.string().optional(),
  dataLimite: z.string().optional(),
});

const TIPO_MAP: Record<string, string> = {
  Presencial: "PRESENCIAL",
  Online: "ONLINE",
  Híbrido: "HIBRIDO",
};

const STATUS_MAP: Record<string, string> = {
  Agendado: "AGENDADO",
  Confirmado: "CONFIRMADO",
  Pendente: "AGENDADO",
};

function formatIsoDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function meta(_args: Route.MetaArgs) {
  return [{ title: "Novo Culto · Igreja Conect" }];
}

/**
 * Loader: carrega pastores cadastrados e ministérios ativos.
 */
export async function loader({ context }: Route.LoaderArgs) {
  const user = context.get(userContext);
  if (!user) throw new Response("Não autenticado.", { status: 401 });

  const [pastores, ministerios] = await Promise.all([
    prisma.membro.findMany({
      where: { cargo: "PASTOR" },
      select: { id: true, nome: true },
      orderBy: { nome: "asc" },
    }).catch(() => []),
    prisma.ministerio.findMany({
      where: { status: "ATIVO" },
      select: { id: true, nome: true },
      orderBy: { nome: "asc" },
    }).catch(() => []),
  ]);

  return { user, pastores, ministerios };
}

/**
 * Action: processa a criação simples ou em lote (recorrente) de cultos.
 */
export async function action({ request, context }: Route.ActionArgs) {
  const user = context.get(userContext);
  if (!user) throw new Response("Não autenticado.", { status: 401 });

  const rawFormData = await request.formData();
  const formData = Object.fromEntries(rawFormData);
  const parsed = cultoSchema.safeParse(formData);

  if (!parsed.success) {
    return data({ errors: parsed.error.flatten().fieldErrors }, { status: 422 });
  }

  // Resolve o preletor com base nas opções
  const preletor = parsed.data.preletorOpcao === "outro"
    ? parsed.data.preletorOutro
    : parsed.data.preletorOpcao;

  const isRecorrente = parsed.data.recorrente === "true";
  const dataInicioStr = parsed.data.data;
  const dataLimiteStr = parsed.data.dataLimite;

  if (isRecorrente && dataLimiteStr) {
    const start = new Date(dataInicioStr + "T00:00:00");
    const end = new Date(dataLimiteStr + "T23:59:59");

    let diasSemana = rawFormData.getAll("diasSemana").map(Number);
    if (diasSemana.length === 0) {
      diasSemana = [start.getDay()];
    }

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      if (diasSemana.includes(d.getDay())) {
        const dataStr = formatIsoDate(d);
        const input: CriarCultoInput = {
          titulo: parsed.data.nome,
          data: dataStr,
          horario: parsed.data.horario,
          tipo: TIPO_MAP[parsed.data.tipo] as CriarCultoInput["tipo"],
          status: STATUS_MAP[parsed.data.status] as CriarCultoInput["status"],
          preletor: preletor || undefined,
          ministerioId: parsed.data.ministerioId || undefined,
        };
        await criarCulto(input, user);
      }
    }
  } else {
    const input: CriarCultoInput = {
      titulo: parsed.data.nome,
      data: dataInicioStr,
      horario: parsed.data.horario,
      tipo: TIPO_MAP[parsed.data.tipo] as CriarCultoInput["tipo"],
      status: STATUS_MAP[parsed.data.status] as CriarCultoInput["status"],
      preletor: preletor || undefined,
      ministerioId: parsed.data.ministerioId || undefined,
    };
    await criarCulto(input, user);
  }

  return redirect("/app/cultos");
}

const DIAS_SEMANA = [
  { value: 0, label: "Dom" },
  { value: 1, label: "Seg" },
  { value: 2, label: "Ter" },
  { value: 3, label: "Qua" },
  { value: 4, label: "Qui" },
  { value: 5, label: "Sex" },
  { value: 6, label: "Sáb" },
];

export default function NovoCulto({ loaderData }: Route.ComponentProps) {
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const { pastores, ministerios } = loaderData;

  const [preletorOpcao, setPreletorOpcao] = useState("");
  const [preletorOutro, setPreletorOutro] = useState("");
  const [ministerioId, setMinisterioId] = useState("");
  const [recorrente, setRecorrente] = useState(false);
  const [dataLimite, setDataLimite] = useState("");
  const [diasSelecionados, setDiasSelecionados] = useState<number[]>([]);

  const toggleDiaSemana = (val: number) => {
    if (diasSelecionados.includes(val)) {
      setDiasSelecionados(diasSelecionados.filter((d) => d !== val));
    } else {
      setDiasSelecionados([...diasSelecionados, val]);
    }
  };

  const [transmitirAoVivo, setTransmitirAoVivo] = useState(false);
  const [progFile, setProgFile] = useState<File | null>(null);
  const [slideFile, setSlideFile] = useState<File | null>(null);

  const TIPO_OPTIONS = [
    { value: "Presencial", label: "Presencial" },
    { value: "Online", label: "Online" },
    { value: "Híbrido", label: "Híbrido" },
  ];

  const STATUS_OPTIONS = [
    { value: "Agendado", label: "Agendado" },
    { value: "Confirmado", label: "Confirmado" },
    { value: "Pendente", label: "Pendente" },
  ];

  // Constrói as opções de preletores
  const preletoresOptions = [
    { value: "", label: "Pastor Titular (Automático)" },
    ...pastores.map((p) => ({ value: p.nome, label: `Pr. ${p.nome}` })),
    { value: "outro", label: "Outro Pregador (Digitar Nome)" },
  ];

  const ministeriosOptions = [
    { value: "", label: "Nenhum / Geral" },
    ...ministerios.map((m) => ({ value: m.id, label: m.nome })),
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <Breadcrumb
        items={[
          { label: "Cultos", href: "/app/cultos" },
          { label: "Novo Culto" },
        ]}
      />

      <Form method="post" noValidate className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <input type="hidden" name="transmitirAoVivo" value={transmitirAoVivo ? "true" : "false"} />
        <input type="hidden" name="recorrente" value={recorrente ? "true" : "false"} />

        {/* Coluna da Esquerda (Principal): Informações Gerais e Liderança */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Card 1: Informações Gerais do Culto */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-5">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
              <div className="p-2 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <h2 className="text-base font-extrabold text-slate-900">Informações Básicas</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <Input
                  id="nome"
                  name="nome"
                  label="Nome do Culto"
                  placeholder="Ex: Culto de Celebração"
                  required
                  autoFocus
                />
              </div>

              <Input
                id="data"
                name="data"
                label="Data Inicial"
                type="date"
                required
                placeholder="dd/mm/aaaa"
              />

              <Input
                id="horario"
                name="horario"
                label="Horário"
                type="time"
                required
                placeholder="Ex: 19:30"
              />

              <Select
                name="tipo"
                label="Tipo de Culto"
                required
                options={TIPO_OPTIONS}
              />

              <Select
                name="status"
                label="Status do Culto"
                required
                options={STATUS_OPTIONS}
              />
            </div>
          </div>

          {/* Card 2: Pregador e Ministério Responsável */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-5">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
              <div className="p-2 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <h2 className="text-base font-extrabold text-slate-900">Pregador e Ministério Responsável</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Ministério Responsável */}
              <Select
                name="ministerioId"
                label="Ministério Responsável"
                value={ministerioId}
                onChange={(e) => setMinisterioId(e.target.value)}
                options={ministeriosOptions}
              />

              {/* Preletor / Pregador */}
              <Select
                name="preletorOpcao"
                label="Pastor Pregador / Preletor"
                value={preletorOpcao}
                onChange={(e) => setPreletorOpcao(e.target.value)}
                options={preletoresOptions}
              />

              {/* Campo extra de texto livre caso selecione "Outro Pregador" */}
              {preletorOpcao === "outro" && (
                <div className="md:col-span-2">
                  <Input
                    id="preletorOutro"
                    name="preletorOutro"
                    label="Nome do Pregador Visitante"
                    placeholder="Digite o nome completo do pregador..."
                    value={preletorOutro}
                    onChange={(e) => setPreletorOutro(e.target.value)}
                    required
                  />
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Coluna da Direita: Recorrência, Configurações Extras e Ações */}
        <div className="space-y-6">
          
          {/* Card 3: Recorrência */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 8H18.5" />
                  </svg>
                </div>
                <h2 className="text-base font-extrabold text-slate-900">Recorrência</h2>
              </div>
              <button
                type="button"
                onClick={() => setRecorrente(!recorrente)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${recorrente ? "bg-blue-600" : "bg-slate-200"}`}
              >
                <span className={`inline-block h-4 w-4 rounded-full bg-white shadow-md transition-transform ${recorrente ? "translate-x-6" : "translate-x-1"}`} />
              </button>
            </div>

            {recorrente && (
              <div className="space-y-4">
                <p className="text-xs text-slate-500 leading-relaxed">
                  Selecione os dias da semana desejados. O culto será agendado em cada um desses dias até a data limite. Se nenhum dia for marcado, repetirá no mesmo dia da data inicial.
                </p>
                
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
                    Dias da Semana
                  </label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {DIAS_SEMANA.map((dia) => {
                      const ativo = diasSelecionados.includes(dia.value);
                      return (
                        <button
                          key={dia.value}
                          type="button"
                          onClick={() => toggleDiaSemana(dia.value)}
                          className={`h-8 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${
                            ativo
                              ? "bg-blue-600 border-blue-600 text-white shadow-xs"
                              : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                          }`}
                        >
                          {dia.label}
                        </button>
                      );
                    })}
                  </div>
                  {/* Inputs ocultos para submeter ao action */}
                  {diasSelecionados.map((dia) => (
                    <input key={dia} type="hidden" name="diasSemana" value={dia} />
                  ))}
                </div>

                <div className="pt-2">
                  <Input
                    id="dataLimite"
                    name="dataLimite"
                    label="Repetir até a data"
                    type="date"
                    required
                    value={dataLimite}
                    onChange={(e) => setDataLimite(e.target.value)}
                    placeholder="dd/mm/aaaa"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Card 4: Configurações extras */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-5">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
              <div className="p-2 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
              <h2 className="text-base font-extrabold text-slate-900">Configurações Extras</h2>
            </div>

            <div className="flex items-center justify-between py-1">
              <div>
                <p className="text-sm font-semibold text-slate-900">Transmitir ao Vivo</p>
                <p className="text-xs text-slate-400 font-medium font-semibold">Transmissão automática.</p>
              </div>
              <button
                type="button"
                onClick={() => setTransmitirAoVivo(!transmitirAoVivo)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${transmitirAoVivo ? "bg-blue-600" : "bg-slate-200"}`}
              >
                <span className={`inline-block h-4 w-4 rounded-full bg-white shadow-md transition-transform ${transmitirAoVivo ? "translate-x-6" : "translate-x-1"}`} />
              </button>
            </div>
          </div>

          {/* Botões de Ações de Submissão */}
          <div className="flex items-center gap-3 pt-2">
            <Button
              type="submit"
              variant="blue"
              loading={isSubmitting}
              className="flex-1 h-11 text-sm"
            >
              {isSubmitting ? "Salvando..." : "Salvar Culto"}
            </Button>
            <Button
              as={Link}
              to="/app/cultos"
              variant="secondary"
              className="flex-1 h-11 text-sm"
            >
              Cancelar
            </Button>
          </div>

        </div>
      </Form>
    </div>
  );
}
