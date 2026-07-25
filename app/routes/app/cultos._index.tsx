/**
 * Rota /app/cultos — Listagem e Programação de Cultos.
 */
import { Link, Form, data, useActionData } from "react-router";
import type { Route } from "./+types/cultos._index";
import { userContext } from "~/lib/user-context";
import { prisma } from "~/db/prisma.server";
import { Button } from "~/components/Button";
import { excluirCulto } from "~/lib/cultos.server";

function formatDate(d: Date): string {
  const dia = String(d.getDate()).padStart(2, "0");
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const ano = d.getFullYear();
  return `${dia}/${mes}/${ano}`;
}

const TIPO_LABEL: Record<string, string> = {
  PRESENCIAL: "Presencial",
  HIBRIDO: "Híbrido",
  ONLINE: "Online",
};

const STATUS_LABEL: Record<string, string> = {
  AGENDADO: "Agendado",
  CONFIRMADO: "Confirmado",
  REALIZADO: "Realizado",
  CANCELADO: "Cancelado",
};

export function meta(_args: Route.MetaArgs) {
  return [{ title: "Cultos · Igreja Conect" }];
}

export async function loader({ context }: Route.LoaderArgs) {
  const user = context.get(userContext);
  if (!user) throw new Response("Não autenticado.", { status: 401 });
  const cultos = await prisma.culto.findMany({
    where: { executado: false },
    orderBy: { data: "desc" },
    include: {
      ministerio: { select: { id: true, nome: true } },
    },
  });
  return { user, cultos };
}

export async function action({ request, context }: Route.ActionArgs) {
  const user = context.get(userContext);
  if (!user) throw new Response("Não autenticado.", { status: 401 });

  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "deletar") {
    const id = formData.get("id");
    if (typeof id !== "string") {
      return new Response(
        JSON.stringify({ error: "ID inválido." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    try {
      await excluirCulto(id, user);
      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    } catch (error: any) {
      return new Response(
        JSON.stringify({ error: error instanceof Error ? error.message : "Erro ao excluir o culto." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
  } else if (intent === "executar") {
    const id = formData.get("id");
    if (typeof id !== "string") {
      return new Response(
        JSON.stringify({ error: "ID inválido." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    try {
      if (!user.cargo || !["ADMIN", "PASTOR"].includes(user.cargo)) {
        return new Response(
          JSON.stringify({ error: "Apenas ADMIN ou PASTOR podem marcar cultos como executados." }),
          { status: 403, headers: { "Content-Type": "application/json" } }
        );
      }

      await prisma.culto.update({
        where: { id },
        data: { executado: true },
      });

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    } catch (error: any) {
      return new Response(
        JSON.stringify({ error: error instanceof Error ? error.message : "Erro ao marcar o culto como executado." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
  }

  return new Response(
    JSON.stringify({ error: "Ação não suportada." }),
    { status: 400, headers: { "Content-Type": "application/json" } }
  );
}

export default function CultosIndex({ loaderData }: Route.ComponentProps) {
  const { cultos } = loaderData;
  const actionData = useActionData<typeof action>();

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {actionData?.error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm font-semibold">
          {actionData.error}
        </div>
      )}
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Cultos</h1>
          <p className="text-sm text-slate-500 mt-1">
            Gerencie a programação e os registros dos cultos da igreja.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button as={Link} to="/app/cultos/novo" variant="blue" className="whitespace-nowrap shrink-0">
            + Novo Culto
          </Button>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card 1: Total de Cultos */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex items-center gap-4">
          <div className="p-3 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total de Cultos</p>
            <p className="text-2xl font-extrabold text-slate-900 mt-0.5">{cultos.length}</p>
          </div>
        </div>

        {/* Card 2: Ao Vivo */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex items-center gap-4">
          <div className="p-3 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Online</p>
            <p className="text-2xl font-extrabold text-slate-900 mt-0.5">{cultos.filter((c) => c.tipo === "ONLINE").length}</p>
          </div>
        </div>
      </div>

      {/* Programação de Cultos Card */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="text-base font-extrabold text-slate-900">Programação de Cultos</h2>
          <div className="flex items-center gap-2">
            <button type="button" className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-colors">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
            </button>
            <button type="button" className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-colors">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
              </svg>
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left px-5 py-3.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Nome do Culto</th>
                <th className="text-left px-5 py-3.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Data</th>
                <th className="text-left px-5 py-3.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Horário</th>
                <th className="text-left px-5 py-3.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tipo</th>
                <th className="text-left px-5 py-3.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Status</th>
                <th className="text-right px-5 py-3.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {cultos.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50/50 transition-colors">
                   <td className="px-5 py-4">
                     <div className="font-semibold text-slate-900">{c.titulo}</div>
                     {((c as any).preletor || (c as any).ministerio) && (
                       <div className="text-[10px] text-slate-400 font-semibold mt-1 space-x-1.5 flex items-center flex-wrap">
                         {(c as any).preletor && (
                           <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-md">
                             Preletor: {(c as any).preletor}
                           </span>
                         )}
                         {(c as any).ministerio && (
                           <span className="bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-md">
                             Ministério: {(c as any).ministerio.nome}
                           </span>
                         )}
                       </div>
                     )}
                   </td>
                  <td className="px-5 py-4 text-slate-600 font-medium">{formatDate(new Date(c.data))}</td>
                  <td className="px-5 py-4 text-slate-600 font-medium">{c.horario}</td>
                  <td className="px-5 py-4">
                    <span className="flex items-center gap-1.5 text-slate-600 font-medium">
                      {c.tipo === "PRESENCIAL" && (
                        <>
                          <svg className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                          Presencial
                        </>
                      )}
                      {c.tipo === "HIBRIDO" && (
                        <>
                          <svg className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                          Híbrido
                        </>
                      )}
                      {c.tipo === "ONLINE" && (
                        <>
                          <svg className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                          </svg>
                          Online
                        </>
                      )}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                      c.status === "CONFIRMADO"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                        : c.status === "AGENDADO"
                        ? "bg-blue-50 text-blue-700 border-blue-100"
                        : c.status === "REALIZADO"
                        ? "bg-slate-100 text-slate-600 border-slate-200"
                        : "bg-red-50 text-red-700 border-red-100"
                    }`}>
                      {STATUS_LABEL[c.status] ?? c.status}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <div className="flex items-center justify-end gap-2.5">
                      {/* Botão de Marcar como Executado (Check) */}
                      <Form
                        method="post"
                        onSubmit={(e) => {
                          if (!confirm("Deseja marcar este culto como executado? Ele sairá da lista ativa.")) {
                            e.preventDefault();
                          }
                        }}
                        className="inline"
                      >
                        <input type="hidden" name="intent" value="executar" />
                        <input type="hidden" name="id" value={c.id} />
                        <button
                          type="submit"
                          className="p-1 text-slate-400 hover:text-emerald-600 transition-colors cursor-pointer"
                          title="Marcar como Executado"
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </button>
                      </Form>

                      <Link to={`/app/cultos/${c.id}/editar`} className="p-1 text-slate-400 hover:text-blue-600 transition-colors" title="Editar Culto">
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </Link>
                      
                      <Form
                        method="post"
                        onSubmit={(e) => {
                          if (!confirm("Tem certeza que deseja excluir definitivamente este culto?")) {
                            e.preventDefault();
                          }
                        }}
                        className="inline"
                      >
                        <input type="hidden" name="intent" value="deletar" />
                        <input type="hidden" name="id" value={c.id} />
                        <button
                          type="submit"
                          className="p-1 text-slate-400 hover:text-red-600 transition-colors cursor-pointer"
                          title="Excluir Culto"
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </Form>
                    </div>
                  </td>
                </tr>
              ))}
              {cultos.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-slate-400 text-sm">
                    Nenhum culto encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-slate-50 flex items-center justify-between text-xs text-slate-400 font-medium">
          <span>Total de {cultos.length} culto{cultos.length !== 1 ? "s" : ""}</span>
        </div>
      </div>

      {/* Bottom Section */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex-1 space-y-3">
          <h3 className="text-lg font-extrabold text-slate-900">Transmissão em Destaque</h3>
          <p className="text-sm text-slate-500 font-medium leading-relaxed">
            O próximo culto de celebração será transmitido em 4K. Prepare os equipamentos e verifique a conexão de rede.
          </p>
          <a href="#configurar" className="inline-flex items-center gap-1.5 text-sm font-bold text-cyan-700 hover:text-cyan-800 transition-colors">
            Configurar transmissão &rarr;
          </a>
        </div>
        <div className="w-full md:w-64 h-40 rounded-xl overflow-hidden shrink-0 shadow-sm border border-slate-100">
          <img src="/transmissao_destaque.png" alt="Câmera de Transmissão" className="w-full h-full object-cover" />
        </div>
      </div>
    </div>
  );
}
