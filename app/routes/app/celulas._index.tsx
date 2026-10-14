import { Link } from "react-router";
import { Badge, Button, EmptyState } from "~/components/ds";
import { STATUS_CELULA_LABEL } from "~/lib/schemas/celulas";
import { listarCelulas } from "~/lib/celulas.server";
import { userContext } from "~/lib/user-context";
import type { Route } from "./+types/celulas._index";

const DIAS_SEMANA: Record<string, string> = {
  DOMINGO: "Domingo",
  SEGUNDA: "Segunda-feira",
  TERCA: "Terça-feira",
  QUARTA: "Quarta-feira",
  QUINTA: "Quinta-feira",
  SEXTA: "Sexta-feira",
  SABADO: "Sábado",
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

// Paleta da barra de cor por índice (tokens semânticos do DS)
const CARD_COLORS = [
  "bg-info",
  "bg-accent",
  "bg-success",
  "bg-warning",
  "bg-danger",
  "bg-accent-strong",
];

function IconLocation() {
  return (
    <svg
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      strokeWidth="2"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
      />
    </svg>
  );
}

function IconClock() {
  return (
    <svg
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      strokeWidth="2"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

function IconUsers() {
  return (
    <svg
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      strokeWidth="1.8"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
      />
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
          <h1 className="text-3xl font-extrabold text-fg tracking-tight">
            Células
          </h1>
          <p className="text-sm text-muted mt-1">
            Gerencie os grupos de célula e seus participantes.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            as={Link}
            to="/app/celulas/novo"
            variant="primary"
            className="whitespace-nowrap shrink-0"
          >
            + Nova Célula
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-surface border border-border rounded-xl p-4 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-accent-soft-2 text-accent">
            <IconUsers />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-subtle">
              Total de Células
            </p>
            <p className="text-3xl font-extrabold text-fg">{celulas.length}</p>
          </div>
        </div>
        <div className="bg-surface border border-border rounded-xl p-4 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-success-soft text-success">
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth="1.8"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-subtle">
              Células Ativas
            </p>
            <p className="text-3xl font-extrabold text-fg">{celulas.length}</p>
          </div>
        </div>
        <div className="bg-surface border border-border rounded-xl p-4 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-accent-soft text-accent-strong">
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth="1.8"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-subtle">
              Total de Membros
            </p>
            <p className="text-3xl font-extrabold text-fg">
              {celulas.reduce((s, c) => s + c.totalMembros, 0)}
            </p>
          </div>
        </div>
      </div>

      {isEmpty ? (
        <EmptyState
          className="py-16"
          icon={
            <svg
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth="1.5"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          }
          title="Nenhuma célula encontrada"
          description="Crie sua primeira célula para organizar os pequenos grupos da sua igreja."
          action={
            <Button as={Link} to="/app/celulas/novo" variant="primary">
              + Nova Célula
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {celulas.map((celula, idx) => {
            const cor = CARD_COLORS[idx % CARD_COLORS.length];
            const dia = celula.diaSemana
              ? (DIAS_SEMANA[celula.diaSemana] ?? celula.diaSemana)
              : "";
            return (
              <article
                key={celula.id}
                className="bg-surface border border-border rounded-2xl overflow-hidden flex flex-col hover:shadow-md transition-shadow"
              >
                <div className={`h-1.5 w-full ${cor}`} aria-hidden="true" />
                <div className="p-5 flex flex-col flex-1 gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="text-base font-extrabold text-fg leading-tight">
                      {celula.nome}
                    </h2>
                    <Badge
                      tone={
                        celula.status === "ATIVA"
                          ? "success"
                          : celula.status === "EM_FORMACAO"
                            ? "warning"
                            : "neutral"
                      }
                    >
                      {STATUS_CELULA_LABEL[celula.status as keyof typeof STATUS_CELULA_LABEL] ?? celula.status}
                    </Badge>
                  </div>

                  <div className="space-y-2 text-sm text-muted">
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-6 rounded-full bg-gradient-to-br from-accent-soft-2 to-accent-soft text-accent-strong text-xs font-bold flex items-center justify-center shrink-0">
                        {celula.lider
                          ? celula.lider.nome.charAt(0).toUpperCase()
                          : "?"}
                      </div>
                      <span className="text-fg font-medium truncate">
                        {celula.lider?.nome ?? "Sem líder"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-subtle shrink-0">
                        <IconLocation />
                      </span>
                      <span className="truncate">
                        {celula.endereco ?? "Sem endereço"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-subtle shrink-0">
                        <IconClock />
                      </span>
                      <span>
                        {dia
                          ? `${dia} às ${celula.horario}`
                          : (celula.horario ?? "Horário não definido")}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 mt-auto border-t border-surface-2">
                    <div className="flex items-center gap-1.5">
                      <svg
                        className="h-4 w-4 text-subtle"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        strokeWidth="2"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                      </svg>
                      <span className="text-sm font-semibold text-fg">
                        {celula.capacidade
                          ? `${celula.totalMembros} de ${celula.capacidade} vagas`
                          : `${celula.totalMembros} membros`}
                      </span>
                    </div>
                    <Link
                      to={`/app/celulas/${celula.id}`}
                      className="text-xs font-bold text-accent hover:text-accent-strong transition-colors"
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
