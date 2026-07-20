/**
 * Rota /app/cultos/novo — criar novo culto ou programação.
 */
import { useState } from "react";
import { Form, Link, useNavigation, redirect, data } from "react-router";
import type { Route } from "./+types/cultos.novo";
import { userContext } from "~/lib/user-context";
import { criarCulto } from "~/lib/cultos.server";
import type { CriarCultoInput } from "~/lib/cultos.server";
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

export function meta(_args: Route.MetaArgs) {
  return [{ title: "Novo Culto · Igreja Conect" }];
}

export async function loader({ context }: Route.LoaderArgs) {
  const user = context.get(userContext);
  if (!user) throw new Response("Não autenticado.", { status: 401 });
  return { user };
}

export async function action({ request, context }: Route.ActionArgs) {
  const user = context.get(userContext);
  if (!user) throw new Response("Não autenticado.", { status: 401 });

  const formData = Object.fromEntries(await request.formData());
  const parsed = cultoSchema.safeParse(formData);

  if (!parsed.success) {
    return data({ errors: parsed.error.flatten().fieldErrors }, { status: 422 });
  }

  const input: CriarCultoInput = {
    titulo: parsed.data.nome,
    data: parsed.data.data,
    horario: parsed.data.horario,
    tipo: TIPO_MAP[parsed.data.tipo] as CriarCultoInput["tipo"],
    status: STATUS_MAP[parsed.data.status] as CriarCultoInput["status"],
  };

  await criarCulto(input, user);
  return redirect("/app/cultos");
}

export default function NovoCulto({ loaderData }: Route.ComponentProps) {
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

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



  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
      {/* Breadcrumbs */}
      <Breadcrumb
        items={[
          { label: "Cultos", href: "/app/cultos" },
          { label: "Novo Culto" },
        ]}
      />

      <Form method="post" noValidate className="space-y-6">
        <input type="hidden" name="transmitirAoVivo" value={transmitirAoVivo ? "true" : "false"} />

        {/* Page Header */}
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
              Novo Culto
            </h1>
            <p className="text-sm font-medium text-slate-500 mt-1">
              Registre um novo culto ou programação eclesiástica.
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <Button as={Link} to="/app/cultos" variant="secondary" className="whitespace-nowrap shrink-0">
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="blue"
              loading={isSubmitting}
              className="whitespace-nowrap shrink-0"
            >
              {isSubmitting ? "Salvando..." : "Salvar Culto"}
            </Button>
          </div>
        </div>

        {/* Card 1: Informações Gerais */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-5">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 20H5a2 2 0 03-2-2V8a2 2 0 032-2h14a2 2 0 032 2v10a2 2 0 03-2 2zM5 8h14M5 12h14m-14 4h14" />
              </svg>
            </div>
            <h2 className="text-base font-extrabold text-slate-900">Informações Gerais</h2>
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
              label="Data"
              type="date"
              required
              placeholder="dd/mm/aaaa"
            />

            <Input
              id="horario"
              name="horario"
              label="Horário"
              type="text"
              required
              placeholder="Ex: 19:30"
            />
          </div>
        </div>

        {/* Card 2: Detalhes de Programação */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-5">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <h2 className="text-base font-extrabold text-slate-900">Detalhes de Programação</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Select
              name="tipo"
              label="Tipo"
              required
              options={TIPO_OPTIONS}
            />

            <Select
              name="status"
              label="Status"
              required
              options={STATUS_OPTIONS}
            />
          </div>
        </div>

        {/* Card 3: Configurações Extras */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-5">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <h2 className="text-base font-extrabold text-slate-900">Configurações Extras</h2>
          </div>

          <div className="space-y-5">


            {/* Upload fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
              {/* Programação Upload */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700">Arquivo da Programação</label>
                {progFile ? (
                  <div className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700">
                    <div className="flex items-center gap-2.5 truncate">
                      <svg className="h-5 w-5 text-blue-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <span className="font-semibold truncate">{progFile.name}</span>
                    </div>
                    <button type="button" onClick={() => setProgFile(null)} className="text-red-500 hover:text-red-700 font-bold text-xs shrink-0 pl-2">
                      Remover
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-2xl cursor-pointer hover:bg-slate-50/50 transition-all p-4">
                    <div className="flex flex-col items-center justify-center text-center">
                      <svg className="w-7 h-7 text-slate-400 mb-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      <p className="text-xs text-slate-600 font-semibold">
                        <span className="text-blue-600 hover:underline">Upload do arquivo</span> ou arraste
                      </p>
                      <p className="text-[10px] text-slate-400 mt-1">PDF, DOCX até 10MB</p>
                    </div>
                    <input
                      type="file"
                      className="hidden"
                      accept=".pdf,.docx,.doc"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          setProgFile(e.target.files[0]);
                        }
                      }}
                    />
                  </label>
                )}
              </div>

              {/* Apresentação Slide Upload */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700">Apresentação em Slide</label>
                {slideFile ? (
                  <div className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700">
                    <div className="flex items-center gap-2.5 truncate">
                      <svg className="h-5 w-5 text-orange-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 12l3-3 3 3M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                      <span className="font-semibold truncate">{slideFile.name}</span>
                    </div>
                    <button type="button" onClick={() => setSlideFile(null)} className="text-red-500 hover:text-red-700 font-bold text-xs shrink-0 pl-2">
                      Remover
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-2xl cursor-pointer hover:bg-slate-50/50 transition-all p-4">
                    <div className="flex flex-col items-center justify-center text-center">
                      <svg className="w-7 h-7 text-slate-400 mb-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      <p className="text-xs text-slate-600 font-semibold">
                        <span className="text-blue-600 hover:underline">Upload do slide</span> ou arraste
                      </p>
                      <p className="text-[10px] text-slate-400 mt-1">PPTX, PDF até 25MB</p>
                    </div>
                    <input
                      type="file"
                      className="hidden"
                      accept=".pptx,.ppt,.pdf"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          setSlideFile(e.target.files[0]);
                        }
                      }}
                    />
                  </label>
                )}
              </div>
            </div>

            {/* Toggle Transmitir ao Vivo */}
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-semibold text-slate-900">Transmitir ao Vivo</p>
                <p className="text-xs text-slate-400 font-medium">Habilitar transmissão online automática para esta programação.</p>
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
        </div>
      </Form>
    </div>
  );
}
