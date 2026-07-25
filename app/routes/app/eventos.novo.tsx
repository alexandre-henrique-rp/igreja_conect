/**
 * Rota /app/eventos/novo — Criar Novo Evento.
 */
import { useState } from "react";
import { Form, Link, useNavigation, redirect, data } from "react-router";
import type { Route } from "./+types/eventos.novo";
import { userContext } from "~/lib/user-context";
import { criarEvento } from "~/lib/eventos.server";
import type { CriarEventoInput } from "~/lib/eventos.server";
import { prisma } from "~/db/prisma.server";
import { z } from "zod";
import { Button } from "~/components/Button";
import { Input } from "~/components/Input";
import { Select } from "~/components/Select";
import { Breadcrumb } from "~/components/Breadcrumb";

const eventoSchema = z.object({
  titulo: z.string().min(1, "Título do evento é obrigatório"),
  descricao: z.string().optional(),
  tipo: z.enum(["ESPECIAL", "CAMPANHA", "CONFRATERNIZACAO", "RETIRO", "OUTRO"]),
  status: z.enum(["RASCUNHO", "PUBLICADO", "REALIZADO", "CANCELADO"]),
  dataInicio: z.string().min(1, "Data de início é obrigatória"),
  horaInicio: z.string().min(1, "Horário de início é obrigatório"),
  dataFim: z.string().optional(),
  horaFim: z.string().optional(),
  local: z.string().optional(),
  responsavelId: z.string().optional(),
});

export function meta(_args: Route.MetaArgs) {
  return [{ title: "Novo Evento · Igreja Conect" }];
}

export async function loader({ context }: Route.LoaderArgs) {
  const user = context.get(userContext);
  if (!user) throw new Response("Não autenticado.", { status: 401 });

  const membros = await prisma.membro.findMany({
    select: { id: true, nome: true },
    orderBy: { nome: "asc" },
  });

  return { user, membros };
}

export async function action({ request, context }: Route.ActionArgs) {
  const user = context.get(userContext);
  if (!user) throw new Response("Não autenticado.", { status: 401 });

  const formData = Object.fromEntries(await request.formData());
  const parsed = eventoSchema.safeParse(formData);

  if (!parsed.success) {
    return new Response(
      JSON.stringify({ errors: parsed.error.flatten().fieldErrors }),
      { status: 422, headers: { "Content-Type": "application/json" } }
    );
  }

  // Concatenar Data e Hora para o formato ISO aceito pelo Date constructor
  const dataInicioIso = `${parsed.data.dataInicio}T${parsed.data.horaInicio}:00`;
  
  let dataFimIso: string | undefined;
  if (parsed.data.dataFim && parsed.data.horaFim) {
    dataFimIso = `${parsed.data.dataFim}T${parsed.data.horaFim}:00`;
  }

  const input: CriarEventoInput = {
    titulo: parsed.data.titulo,
    descricao: parsed.data.descricao || undefined,
    tipo: parsed.data.tipo,
    status: parsed.data.status,
    dataInicio: dataInicioIso,
    dataFim: dataFimIso,
    local: parsed.data.local || undefined,
    responsavelId: parsed.data.responsavelId || undefined,
  };

  try {
    await criarEvento(input, user);
    return new Response(null, {
      status: 302,
      headers: { Location: "/app/eventos" },
    });
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro ao criar o evento." }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
}

export default function NovoEvento({ loaderData, actionData }: Route.ComponentProps) {
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const { membros } = loaderData;
  const errors = (actionData as any)?.errors;
  const errorMsg = (actionData as any)?.error;

  const TIPO_OPTIONS = [
    { value: "ESPECIAL", label: "Especial" },
    { value: "CAMPANHA", label: "Campanha" },
    { value: "CONFRATERNIZACAO", label: "Confraternização" },
    { value: "RETIRO", label: "Retiro" },
    { value: "OUTRO", label: "Outro" },
  ];

  const STATUS_OPTIONS = [
    { value: "RASCUNHO", label: "Rascunho" },
    { value: "PUBLICADO", label: "Publicado" },
    { value: "REALIZADO", label: "Realizado" },
    { value: "CANCELADO", label: "Cancelado" },
  ];

  const membrosOptions = [
    { value: "", label: "Sem responsável" },
    ...membros.map((m) => ({ value: m.id, label: m.nome })),
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <Breadcrumb
        items={[
          { label: "Eventos", href: "/app/eventos" },
          { label: "Novo Evento" },
        ]}
      />

      {errorMsg && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm font-semibold">
          {errorMsg}
        </div>
      )}

      <Form method="post" noValidate className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Coluna da Esquerda (Principal): Informações do Evento */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Card 1: Informações Gerais */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-5">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
              <div className="p-2 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                </svg>
              </div>
              <h2 className="text-base font-extrabold text-slate-900">Informações Gerais</h2>
            </div>

            <div className="space-y-4">
              <Input
                id="titulo"
                name="titulo"
                label="Título do Evento"
                placeholder="Ex: Retiro de Jovens 2026"
                required
                autoFocus
                error={errors?.titulo?.[0]}
              />

              <div className="space-y-1">
                <label htmlFor="descricao" className="block text-sm font-medium text-slate-700">
                  Descrição / Detalhes do Evento
                </label>
                <textarea
                  id="descricao"
                  name="descricao"
                  rows={4}
                  placeholder="Descreva as atividades do evento, cronograma de palestras ou informações para inscrição..."
                  className="w-full p-3 rounded-md border border-slate-300 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-700 focus-visible:ring-offset-2 text-sm text-slate-900"
                />
              </div>
            </div>
          </div>

          {/* Card 2: Local e Horário */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-5">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
              <div className="p-2 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h2 className="text-base font-extrabold text-slate-900">Programação e Local</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Input
                id="dataInicio"
                name="dataInicio"
                label="Data de Início"
                type="date"
                required
                error={errors?.dataInicio?.[0]}
              />

              <Input
                id="horaInicio"
                name="horaInicio"
                label="Horário de Início"
                type="time"
                required
                error={errors?.horaInicio?.[0]}
              />

              <Input
                id="dataFim"
                name="dataFim"
                label="Data de Término (Opcional)"
                type="date"
                error={errors?.dataFim?.[0]}
              />

              <Input
                id="horaFim"
                name="horaFim"
                label="Horário de Término (Opcional)"
                type="time"
                error={errors?.horaFim?.[0]}
              />

              <div className="md:col-span-2">
                <Input
                  id="local"
                  name="local"
                  label="Local do Evento"
                  placeholder="Ex: Auditório Principal, Chácara Recanto Verde"
                  error={errors?.local?.[0]}
                />
              </div>
            </div>
          </div>

        </div>

        {/* Coluna da Direita: Classificação, Liderança e Ações */}
        <div className="space-y-6">
          
          {/* Card 3: Classificação e Responsabilidade */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-5">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
              <div className="p-2 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <h2 className="text-base font-extrabold text-slate-900">Classificação</h2>
            </div>

            <div className="space-y-5">
              <Select
                name="tipo"
                label="Tipo de Evento"
                required
                options={TIPO_OPTIONS}
              />

              <Select
                name="status"
                label="Status de Publicação"
                required
                options={STATUS_OPTIONS}
              />

              <Select
                name="responsavelId"
                label="Membro Responsável"
                options={membrosOptions}
              />
            </div>
          </div>

          {/* Botões de Ação */}
          <div className="flex items-center gap-3 pt-2">
            <Button
              type="submit"
              variant="blue"
              loading={isSubmitting}
              className="flex-1 h-11 text-sm font-semibold"
            >
              {isSubmitting ? "Salvando..." : "Criar Evento"}
            </Button>
            <Button
              as={Link}
              to="/app/eventos"
              variant="secondary"
              className="flex-1 h-11 text-sm font-semibold"
            >
              Cancelar
            </Button>
          </div>

        </div>
      </Form>
    </div>
  );
}
