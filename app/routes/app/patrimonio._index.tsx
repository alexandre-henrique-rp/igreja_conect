/**
 * Rota /app/patrimonio — inventário patrimonial (`patrimonio.html` do DS).
 *
 * Patrimônio = `ItemEstoque` com `tipo = PATRIMONIO` (RN-EST-01: sempre 1 unidade).
 * O número de patrimônio (tombo) é o `numeroSerie`. O "valor" exibido é o de
 * aquisição (centavos), somado sobre os bens ativos.
 * Manutenção, retorno e baixa continuam nas rotas `/app/estoque/:id/*`.
 */
import { Form, Link } from "react-router";
import BadgeStatusPatrimonio from "~/components/BadgeStatusPatrimonio";
import {
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
import { formatBRLFromCents } from "~/lib/money-format";
import { assertCanManageEstoque, assertCanSeeEstoque } from "~/lib/rbac.server";
import { userContext } from "~/lib/user-context";
import type { Route } from "./+types/patrimonio._index";

const PAGE_SIZE = 25;

const FILTROS = [
  { value: "", label: "Todos" },
  { value: "EM_MANUTENCAO", label: "Em manutenção" },
  { value: "BAIXADO_PERDA", label: "Baixados" },
] as const;

export function meta(_args: Route.MetaArgs) {
  return [{ title: "Patrimônio · Igreja Conect" }];
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const user = context.get(userContext);
  if (!user) throw new Response("Não autenticado.", { status: 401 });
  assertCanSeeEstoque(user);

  let podeGerenciar = true;
  try {
    assertCanManageEstoque(user);
  } catch {
    podeGerenciar = false;
  }

  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 100) || undefined;
  const statusParam = url.searchParams.get("status") ?? "";
  const status = FILTROS.some((f) => f.value === statusParam) ? statusParam : "";
  const page = Math.max(1, Number.parseInt(url.searchParams.get("page") ?? "1", 10) || 1);

  const base = { tipo: "PATRIMONIO" as const };
  const where = {
    ...base,
    // Baixados ficam arquivados; as demais visões mostram só itens ativos.
    ...(status === "BAIXADO_PERDA" ? { statusPatrimonio: "BAIXADO_PERDA" as const } : { ativo: true }),
    ...(status === "EM_MANUTENCAO" ? { statusPatrimonio: "EM_MANUTENCAO" as const } : {}),
    ...(q
      ? {
          OR: [
            { nome: { contains: q } },
            { numeroSerie: { contains: q } },
            { localizacaoFisica: { contains: q } },
            { categoria: { contains: q } },
            { responsavelPatrimonio: { contains: q } },
          ],
        }
      : {}),
  };

  const [total, itens, ativos, emManutencao, semLocal, valorAgg] = await Promise.all([
    prisma.itemEstoque.count({ where }),
    prisma.itemEstoque.findMany({
      where,
      select: {
        id: true,
        nome: true,
        numeroSerie: true,
        localizacaoFisica: true,
        statusPatrimonio: true,
        categoria: true,
        responsavelPatrimonio: true,
        valorAquisicaoCentavos: true,
      },
      orderBy: { nome: "asc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.itemEstoque.count({ where: { ...base, ativo: true } }),
    prisma.itemEstoque.count({ where: { ...base, ativo: true, statusPatrimonio: "EM_MANUTENCAO" } }),
    prisma.itemEstoque.count({
      where: { ...base, ativo: true, OR: [{ localizacaoFisica: null }, { localizacaoFisica: "" }] },
    }),
    prisma.itemEstoque.aggregate({
      where: { ...base, ativo: true },
      _sum: { valorAquisicaoCentavos: true },
    }),
  ]);

  return { itens, total, page, q, status, podeGerenciar, kpis: { ativos, emManutencao, semLocal, valorCentavos: valorAgg._sum.valorAquisicaoCentavos ?? 0 } };
}

export default function PatrimonioIndex({ loaderData }: Route.ComponentProps) {
  const { itens, total, page, q, status, podeGerenciar, kpis } = loaderData;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (status) params.set("status", status);

  return (
    <div className="space-y-6" data-od-id="patrimonio-page">
      <PageHeader
        eyebrow="Operações"
        title="Patrimônio"
        description="Registre bens e a localização de cada ativo da igreja."
        actions={
          podeGerenciar ? (
            <Button as={Link} to="/app/patrimonio/novo" variant="primary">
              Novo patrimônio
            </Button>
          ) : undefined
        }
      />

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4" aria-label="Indicadores de patrimônio" data-od-id="patrimonio-kpis">
        <KpiCard label="Ativos cadastrados" value={kpis.ativos} hint="bens em uso" tone="accent" icon={<Icon name="archive" size="md" />} />
        <KpiCard label="Em manutenção" value={kpis.emManutencao} hint="acompanhar retorno" tone="warning" icon={<Icon name="alert-triangle" size="md" />} />
        <KpiCard label="Sem localização" value={kpis.semLocal} hint="precisam de conferência" tone="info" icon={<Icon name="search" size="md" />} />
        <KpiCard label="Valor de aquisição" value={formatBRLFromCents(kpis.valorCentavos)} hint="soma dos bens ativos" tone="success" icon={<Icon name="wallet" size="md" />} />
      </section>

      <Card padding="none" data-od-id="patrimonio-inventory">
        <CardHeader
          title="Inventário patrimonial"
          description={`${total} ${total === 1 ? "bem" : "bens"} nesta visão`}
        />
        <CardBody>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <nav aria-label="Filtrar por situação" className="flex flex-wrap gap-2">
              {FILTROS.map((f) => {
                const ativo = f.value === status;
                const p = new URLSearchParams(q ? { q } : {});
                if (f.value) p.set("status", f.value);
                const qs = p.toString();
                return (
                  <Link
                    key={f.value || "todos"}
                    to={qs ? `/app/patrimonio?${qs}` : "/app/patrimonio"}
                    aria-current={ativo ? "page" : undefined}
                    className={
                      ativo
                        ? "rounded-full bg-accent-soft px-3 py-1.5 text-xs font-bold text-accent-strong"
                        : "rounded-full px-3 py-1.5 text-xs font-bold text-muted hover:bg-surface-3 hover:text-fg"
                    }
                  >
                    {f.label}
                  </Link>
                );
              })}
            </nav>
            <Form method="get" role="search" aria-label="Pesquisar patrimônio" className="flex gap-2">
              {status && <input type="hidden" name="status" value={status} />}
              <input
                type="search"
                name="q"
                defaultValue={q}
                placeholder="Nome, tombo ou local"
                aria-label="Buscar patrimônio"
                className="h-10 w-full rounded-md border border-border-strong bg-surface px-3 text-sm text-fg placeholder:text-subtle focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30 sm:w-64"
              />
              <Button type="submit" variant="secondary" size="sm">
                Buscar
              </Button>
            </Form>
          </div>

          {itens.length === 0 ? (
            <EmptyState
              icon={<Icon name="archive" size="lg" />}
              title={q || status ? "Nenhum bem encontrado" : "Nenhum patrimônio cadastrado"}
              description={
                q || status
                  ? "Ajuste a busca ou escolha outra visão."
                  : "Cadastre o primeiro bem para começar o inventário."
              }
              action={
                podeGerenciar && !q && !status ? (
                  <Button as={Link} to="/app/patrimonio/novo" variant="primary">
                    Novo patrimônio
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <TableWrap>
              <Table>
                <caption className="sr-only">Inventário patrimonial</caption>
                <TableHeader>
                  <TableRow>
                    <TableHead>Patrimônio</TableHead>
                    <TableHead>Nº de patrimônio</TableHead>
                    <TableHead>Localização</TableHead>
                    <TableHead>Responsável</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {itens.map((i) => (
                    <TableRow key={i.id}>
                      <TableCell>
                        <Link to={`/app/patrimonio/${i.id}`} className="font-bold text-fg hover:text-accent">
                          {i.nome}
                        </Link>
                        {i.categoria && <p className="text-xs text-muted">{i.categoria}</p>}
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-xs text-muted">{i.numeroSerie ?? "—"}</span>
                      </TableCell>
                      <TableCell>{i.localizacaoFisica || <span className="text-muted">Não informada</span>}</TableCell>
                      <TableCell>{i.responsavelPatrimonio || <span className="text-muted">—</span>}</TableCell>
                      <TableCell className="tabular-nums">
                        {i.valorAquisicaoCentavos != null ? formatBRLFromCents(i.valorAquisicaoCentavos) : <span className="text-muted">—</span>}
                      </TableCell>
                      <TableCell>
                        <BadgeStatusPatrimonio status={i.statusPatrimonio} />
                      </TableCell>
                      <TableCell>
                        <Link
                          to={`/app/patrimonio/${i.id}`}
                          className="text-sm font-bold text-accent-strong hover:underline"
                          aria-label={`Ver patrimônio ${i.nome}`}
                        >
                          Ver patrimônio
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

      {itens.length > 0 && (
        <Pagination
          current={page}
          total={totalPages}
          basePath="/app/patrimonio"
          searchParams={params}
          totalItems={total}
          pageSize={PAGE_SIZE}
        />
      )}
    </div>
  );
}
