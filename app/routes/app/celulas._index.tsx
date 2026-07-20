import { Link } from "react-router";
import type { Route } from "./+types/celulas._index";
import { userContext } from "~/lib/user-context";
import { listarCelulas } from "~/lib/celulas.server";
import type { CelulaComLider } from "~/lib/celulas.server";
import { Button } from "~/components/Button";

const DIAS_SEMANA: Record<string, string> = {
  DOMINGO: "Domingo", SEGUNDA: "Segunda-feira", TERCA: "Terça-feira",
  QUARTA: "Quarta-feira", QUINTA: "Quinta-feira", SEXTA: "Sexta-feira", SABADO: "Sábado",
};

export function meta(_args: Route.MetaArgs) {
  return [{ title: "Células · Igreja Conect" }];
}

export async function loader({ context }: Route.LoaderArgs) {
  const user = context.get(userContext);
  if (!user) throw new Response("Não autenticado.", { status: 401 });
  const celulas = await listarCelulas(user);
  return { user, celulas };
}

const CARD_COLORS = [
  "#3B82F6", "#8B5CF6", "#10B981", "#F59E0B",
  "#EC4899", "#06B6D4", "#6366F1", "#EF4444",
];

function IconLocation() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function IconClock() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function IconUsers() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

export default function CelulasIndex({ loaderData }: Route.ComponentProps) {
  const { celulas } = loaderData;
  const isEmpty = celulas.length === 0;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Células</h1>
          <p className="text-sm text-slate-500 mt-1">
            Gerencie os grupos de célula e seus participantes.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button as={Link} to="/app/celulas/novo" variant="blue" className="whitespace-nowrap shrink-0">
            + Nova Célula
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-blue-50 text-blue-600">
            <IconUsers />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Total de Células</p>
            <p className="text-3xl font-extrabold text-slate-900">{celulas.length}</p>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-emerald-50 text-emerald-600">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Células Ativas</p>
            <p className="text-3xl font-extrabold text-slate-900">{celulas.length}</p>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-purple-50 text-purple-600">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Total de Membros</p>
            <p className="text-3xl font-extrabold text-slate-900">
              {celulas.reduce((s, c) => s + c.totalMembros, 0)}
            </p>
          </div>
        </div>
      </div>

      {isEmpty ? (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="w-48 h-48 mb-6 relative flex items-center justify-center">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-50 to-indigo-100 rounded-3xl" />
            <svg className="relative h-24 w-24 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-extrabold text-slate-900 mb-2">Nenhuma célula encontrada</h2>
          <p className="text-sm text-slate-500 text-center max-w-xs mb-6 leading-relaxed">
            Crie sua primeira célula para organizar os pequenos grupos da sua igreja.
          </p>
          <Link to="/app/celulas/novo">
            <Button variant="blue" className="whitespace-nowrap">
              + Nova Célula
            </Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {celulas.map((celula, idx) => {
            const cor = CARD_COLORS[idx % CARD_COLORS.length];
            const dia = celula.diaSemana ? (DIAS_SEMANA[celula.diaSemana] ?? celula.diaSemana) : "";
            return (
              <article
                key={celula.id}
                className="bg-white border border-slate-200 rounded-2xl overflow-hidden flex flex-col hover:shadow-md transition-shadow"
              >
                <div className="h-1.5 w-full" style={{ backgroundColor: cor }} />
                <div className="p-5 flex flex-col flex-1 gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="text-base font-extrabold text-slate-900 leading-tight">{celula.nome}</h2>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                      ATIVA
                    </span>
                  </div>

                  <div className="space-y-2 text-sm text-slate-600">
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-6 rounded-full bg-gradient-to-br from-blue-100 to-indigo-200 text-blue-800 text-xs font-bold flex items-center justify-center shrink-0">
                        {celula.lider ? celula.lider.nome.charAt(0).toUpperCase() : "?"}
                      </div>
                      <span className="text-slate-700 font-medium truncate">{celula.lider?.nome ?? "Sem líder"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400 shrink-0"><IconLocation /></span>
                      <span className="truncate">{celula.endereco ?? "Sem endereço"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400 shrink-0"><IconClock /></span>
                      <span>{dia ? `${dia} às ${celula.horario}` : (celula.horario ?? "Horário não definido")}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 mt-auto border-t border-slate-100">
                    <div className="flex items-center gap-1.5">
                      <svg className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span className="text-sm font-semibold text-slate-700">{celula.totalMembros} membros</span>
                    </div>
                    <Link
                      to={`/app/celulas/${celula.id}`}
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
