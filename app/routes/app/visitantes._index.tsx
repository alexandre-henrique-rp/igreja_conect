/**
 * Rota /app/visitantes — acolhimento de visitantes (`visitantes.html` do DS).
 *
 * Visitante = `Membro` com `tipo = VISITANTE`. A listagem reaproveita
 * `listMembros` (RBAC fina: DISCIPULADOR vê apenas os seus). Origem,
 * responsável e status (Novo / Acompanhar / Retornou) vêm do acolhimento
 * (`resumoAcolhimento`): o status é derivado da linha do tempo de cada
 * visitante.
 */
import { Form, Link } from "react-router";
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  Icon,
  KpiCard,
  PageHeader,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableWrap,
} from "~/components/ds";
import { Pagination } from "~/components/Pagination";
import { prisma } from "~/db/prisma.server";
import { resumoAcolhimento } from "~/lib/acolhimento.server";
import { ORIGEM_LABEL } from "~/lib/schemas/acolhimento";
import { listMembros } from "~/lib/members.server";
import { userContext } from "~/lib/user-context";
import type { Route } from "./+types/visitantes._index";

const PAGE_SIZE = 25;

export function meta(_args: Route.MetaArgs) {
  return [{ title: "Visitantes · Igreja Conect" }];
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const user = context.get(userContext);
  if (!user) throw new Response("Não autenticado.", { status: 401 });

  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 100) || undefined;
  const page = Math.max(1, Number.parseInt(url.searchParams.get("page") ?? "1", 10) || 1);

  const agora = new Date();
  const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1);
  const inicioMesAnterior = new Date(agora.getFullYear(), agora.getMonth() - 1, 1);
  const base = { tipo: "VISITANTE" as const };

  const [lista, esteMes, mesAnterior] = await Promise.all([
    listMembros({ tipo: "VISITANTE", q, page, pageSize: PAGE_SIZE }, user),
    prisma.membro.count({ where: { ...base, createdAt: { gte: inicioMes } } }),
    prisma.membro.count({ where: { ...base, createdAt: { gte: inicioMesAnterior, lt: inicioMes } } }),
  ]);
  const resumo = await resumoAcolhimento(lista.items.map((v) => v.id));

  return {
    visitantes: lista.items.map((v) => ({
      id: v.id,
      nome: v.nome,
      email: v.email,
      telefone: v.telefone,
      cidade: v.cidade,
      estado: v.estado,
      createdAt: (resumo.porMembro.get(v.id)?.dataPrimeiraVisita ?? v.createdAt).toISOString(),
      origem: resumo.porMembro.get(v.id)?.origemVisita ?? null,
      responsavel: resumo.porMembro.get(v.id)?.responsavel ?? null,
      status: resumo.porMembro.get(v.id)?.status ?? "NOVO",
    })),
    total: lista.total,
    page: lista.page,
    q,
    kpis: { esteMes, mesAnterior, ...resumo.kpis },
  };
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

const STATUS_BADGE = {
  NOVO: { tone: "info", label: "Novo" },
  ACOMPANHAR: { tone: "warning", label: "Acompanhar" },
  RETORNOU: { tone: "success", label: "Retornou" },
} as const;

/** Variação percentual vs. mês anterior (null quando não há base de comparação). */
function variacao(atual: number, anterior: number): { value: string; direction: "up" | "down" } | undefined {
  if (anterior <= 0) return undefined;
  const pct = Math.round(((atual - anterior) / anterior) * 100);
  if (pct === 0) return undefined;
  return { value: `${Math.abs(pct)}%`, direction: pct > 0 ? "up" : "down" };
}

export default function VisitantesIndex({ loaderData }: Route.ComponentProps) {
  const { visitantes, total, page, q, kpis } = loaderData;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const searchParams = new URLSearchParams(q ? { q } : {});

  return (
    <div className="space-y-6" data-od-id="visitors-page">
      <PageHeader
        eyebrow="Pessoas · Acolhimento"
        title="Visitantes"
        description="Registre cada primeiro contato e acompanhe os próximos passos com cuidado."
        actions={
          <Button as={Link} to="/app/visitantes/novo" variant="primary">
            Novo visitante
          </Button>
        }
      />

      <section
        className="grid grid-cols-2 gap-4 lg:grid-cols-4"
        aria-label="Indicadores de visitantes"
        data-od-id="visitors-kpis"
      >
        <KpiCard
          label="Este mês"
          value={kpis.esteMes}
          delta={variacao(kpis.esteMes, kpis.mesAnterior)}
          hint="vs. mês anterior"
          tone="accent"
          icon={<Icon name="user-plus" size="md" />}
        />
        <KpiCard label="Em acompanhamento" value={kpis.acompanhando} hint="próxima ação pendente" tone="warning" icon={<Icon name="clock" size="md" />} />
        <KpiCard label="Retornaram" value={kpis.retornaram} hint="nos últimos 30 dias" tone="success" icon={<Icon name="check" size="md" />} />
        <KpiCard label="Viraram membros" value={kpis.convertidos} hint="neste trimestre" tone="info" icon={<Icon name="users" size="md" />} />
      </section>

      <Form method="get" role="search" aria-label="Pesquisar visitantes" className="flex flex-col gap-2 sm:flex-row" data-od-id="visitors-filters">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Buscar por nome..."
          aria-label="Buscar visitante por nome"
          className="h-11 w-full rounded-md border border-border-strong bg-surface px-3 text-sm text-fg placeholder:text-subtle focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
        />
        <Button type="submit" variant="secondary">
          Buscar
        </Button>
        {q && (
          <Button as={Link} to="/app/visitantes" variant="ghost">
            Limpar filtros
          </Button>
        )}
      </Form>

      <Card padding="none" data-od-id="visitors-table">
        <CardHeader
          title="Registros recentes"
          description="Acompanhe o cuidado após a primeira visita"
          actions={<span className="text-xs font-bold text-muted">{total} no total</span>}
        />
        <CardBody>
          {visitantes.length === 0 ? (
            <EmptyState
              icon={<Icon name="user-plus" size="lg" />}
              title={q ? "Nenhum visitante encontrado" : "Nenhum visitante registrado"}
              description={
                q
                  ? "Tente ajustar a busca ou limpar os filtros."
                  : "Registre o primeiro contato para que a equipe possa acolher com atenção."
              }
              action={
                <Button as={Link} to="/app/visitantes/novo" variant="primary">
                  Novo visitante
                </Button>
              }
            />
          ) : (
            <TableWrap>
              <Table>
                <caption className="sr-only">Visitantes cadastrados</caption>
                <TableHeader>
                  <TableRow>
                    <TableHead>Visitante</TableHead>
                    <TableHead>Contato</TableHead>
                    <TableHead>Primeira visita</TableHead>
                    <TableHead>Origem</TableHead>
                    <TableHead>Responsável</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visitantes.map((v) => (
                    <TableRow key={v.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar name={v.nome} size={40} />
                          <div className="min-w-0">
                            <p className="truncate font-bold text-fg">{v.nome}</p>
                            <p className="truncate text-xs text-muted">
                              {[v.cidade, v.estado].filter(Boolean).join(", ") || "Cidade não informada"}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm text-fg">{v.email ?? "—"}</p>
                        <p className="text-xs text-muted">{v.telefone ?? "—"}</p>
                      </TableCell>
                      <TableCell>{formatDate(v.createdAt)}</TableCell>
                      <TableCell>
                        {v.origem ? ORIGEM_LABEL[v.origem] : <span className="text-muted">—</span>}
                      </TableCell>
                      <TableCell>{v.responsavel ?? <span className="text-muted">—</span>}</TableCell>
                      <TableCell>
                        <Badge tone={STATUS_BADGE[v.status].tone}>{STATUS_BADGE[v.status].label}</Badge>
                      </TableCell>
                      <TableCell>
                        <Link
                          to={`/app/visitantes/${v.id}`}
                          className="text-sm font-bold text-accent-strong hover:underline"
                          aria-label={`Ver perfil de ${v.nome}`}
                        >
                          Ver perfil
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableWrap>
          )}
        </CardBody>
      </Card>

      {visitantes.length > 0 && (
        <Pagination
          current={page}
          total={totalPages}
          basePath="/app/visitantes"
          searchParams={searchParams}
          totalItems={total}
          pageSize={PAGE_SIZE}
        />
      )}
    </div>
  );
}
