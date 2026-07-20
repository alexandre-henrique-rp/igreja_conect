import { Link } from "react-router";
import type { Route } from "./+types/eventos._index";
import { userContext } from "~/lib/user-context";
import { listarEventos } from "~/lib/eventos.server";
import type { EventoComResponsavel } from "~/lib/eventos.server";
import { Button } from "~/components/Button";

function formatDate(d: Date): string {
  const dia = String(d.getDate()).padStart(2, "0");
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const ano = d.getFullYear();
  return `${dia}/${mes}/${ano}`;
}

function formatTime(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function meta(_args: Route.MetaArgs) {
  return [{ title: "Eventos · Igreja Conect" }];
}

export async function loader({ context }: Route.LoaderArgs) {
  const user = context.get(userContext);
  if (!user) throw new Response("Não autenticado.", { status: 401 });
  const eventos = await listarEventos(user);
  return { user, eventos };
}

const STATUS_STYLES: Record<string, string> = {
  PUBLICADO: "bg-emerald-50 text-emerald-700 border-emerald-200",
  RASCUNHO: "bg-amber-50 text-amber-700 border-amber-200",
  REALIZADO: "bg-blue-50 text-blue-700 border-blue-200",
  CANCELADO: "bg-red-50 text-red-700 border-red-200",
};

const STATUS_LABEL: Record<string, string> = {
  PUBLICADO: "Publicado",
  RASCUNHO: "Rascunho",
  REALIZADO: "Realizado",
  CANCELADO: "Cancelado",
};

const TIPO_LABEL: Record<string, string> = {
  ESPECIAL: "Especial",
  CAMPANHA: "Campanha",
  CONFRATERNIZACAO: "Confraternização",
  RETIRO: "Retiro",
  OUTRO: "Outro",
};

const TIPO_ICON: Record<string, string> = {
  ESPECIAL: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4",
  RETIRO: "M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2",
  CONFRATERNIZACAO: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z",
  CAMPANHA: "M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z",
  OUTRO: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z",
};

const CARD_COLORS = [
  "#3B82F6", "#F59E0B", "#8B5CF6", "#10B981",
  "#EC4899", "#EF4444", "#06B6D4", "#6366F1",
];

function IconCalendar() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}

function IconLocation() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

export default function EventosIndex({ loaderData }: Route.ComponentProps) {
  const { eventos } = loaderData;
  const isEmpty = eventos.length === 0;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Eventos</h1>
          <p className="text-sm text-slate-500 mt-1">
            Gerencie os eventos especiais, retiros e programações da igreja.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button as={Link} to="/app/eventos/novo" variant="blue" className="whitespace-nowrap shrink-0">
            + Novo Evento
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-blue-50 text-blue-600">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Total de Eventos</p>
            <p className="text-3xl font-extrabold text-slate-900">{eventos.length}</p>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-emerald-50 text-emerald-600">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Confirmados</p>
            <p className="text-3xl font-extrabold text-slate-900">
              {eventos.filter((e) => e.status === "PUBLICADO").length}
            </p>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-amber-50 text-amber-600">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Em Planejamento</p>
            <p className="text-3xl font-extrabold text-slate-900">
              {eventos.filter((e) => e.status === "RASCUNHO").length}
            </p>
          </div>
        </div>
      </div>

      {isEmpty ? (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="w-48 h-48 mb-6 relative flex items-center justify-center">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-50 to-indigo-100 rounded-3xl" />
            <svg className="relative h-24 w-24 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <h2 className="text-xl font-extrabold text-slate-900 mb-2">Nenhum evento encontrado</h2>
          <p className="text-sm text-slate-500 text-center max-w-xs mb-6 leading-relaxed">
            Crie seu primeiro evento para organizar as programações especiais da igreja.
          </p>
          <Link to="/app/eventos/novo">
            <Button variant="blue" className="whitespace-nowrap">
              + Novo Evento
            </Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {eventos.map((evento, idx) => {
            const cor = CARD_COLORS[idx % CARD_COLORS.length];
            const statusStyle = STATUS_STYLES[evento.status] || STATUS_STYLES.RASCUNHO;
            const tipoIcon = TIPO_ICON[evento.tipo] || TIPO_ICON.OUTRO;
            return (
              <article
                key={evento.id}
                className="bg-white border border-slate-200 rounded-2xl overflow-hidden flex flex-col hover:shadow-md transition-shadow"
              >
                <div className="h-1.5 w-full" style={{ backgroundColor: cor }} />
                <div className="p-5 flex flex-col flex-1 gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-slate-100 text-slate-500 shrink-0">
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d={tipoIcon} />
                        </svg>
                      </div>
                      <h2 className="text-base font-extrabold text-slate-900 leading-tight">{evento.titulo}</h2>
                    </div>
                  </div>

                  <span className={`inline-flex self-start items-center px-2 py-0.5 rounded-full text-xs font-bold border ${statusStyle}`}>
                    {STATUS_LABEL[evento.status] || evento.status}
                  </span>

                  <div className="space-y-2 text-sm text-slate-600">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400 shrink-0"><IconCalendar /></span>
                      <span>{formatDate(new Date(evento.dataInicio))} às {formatTime(new Date(evento.dataInicio))}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400 shrink-0"><IconLocation /></span>
                      <span className="truncate">{evento.local ?? "Local não definido"}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 mt-auto border-t border-slate-100">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{TIPO_LABEL[evento.tipo] || evento.tipo}</span>
                    <Link
                      to={`/app/eventos/${evento.id}`}
                      className="text-xs font-bold text-blue-600 hover:text-blue-700 transition-colors"
                    >
                      Detalhes →
                    </Link>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
