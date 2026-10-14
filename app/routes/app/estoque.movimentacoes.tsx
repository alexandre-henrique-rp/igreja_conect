/**
 * Rota /app/estoque/movimentacoes — histórico global (`movimentacoes.html` do DS).
 *
 * Lista `MovimentacaoEstoque` de todos os itens, com filtros de busca, período
 * e tipo. A quantidade é gravada com sinal (positivo = entrada, negativo =
 * saída); o modelo não tem "ajuste", categoria nem origem, por isso o mockup
 * só é seguido no que existe nos dados. Registrar movimentações continua em
 * `/app/estoque` e `/app/estoque/:id/movimentar`.
 */
import { Form, Link } from "react-router";
import {
  Badge,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbSeparator,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  Icon,
  Input,
  KpiCard,
  PageHeader,
  Select,
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
import { assertCanSeeEstoque } from "~/lib/rbac.server";
import { userContext } from "~/lib/user-context";
import type { Route } from "./+types/estoque.movimentacoes";

const PAGE_SIZE = 25;
const DATA_RE = /^\d{4}-\d{2}-\d{2}$/;

export function meta(_args: Route.MetaArgs) {
  return [{ title: "Movimentações · Estoque · Igreja Conect" }];
}

/** YYYY-MM-DD no fuso local. */
function isoLocal(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${dia}`;
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const user = context.get(userContext);
  if (!user) throw new Response("Não autenticado.", { status: 401 });
  assertCanSeeEstoque(user);

  const url = new URL(request.url);
  const hoje = new Date();
  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 100) || undefined;
  const tipoParam = url.searchParams.get("tipo");
  const tipo = tipoParam === "ENTRADA" || tipoParam === "SAIDA" ? tipoParam : "";
  const deParam = url.searchParams.get("de") ?? "";
  const ateParam = url.searchParams.get("ate") ?? "";
  // Padrão: do dia 1º do mês até hoje.
  const de = DATA_RE.test(deParam) ? deParam : isoLocal(new Date(hoje.getFullYear(), hoje.getMonth(), 1));
  const ate = DATA_RE.test(ateParam) ? ateParam : isoLocal(hoje);
  const page = Math.max(1, Number.parseInt(url.searchParams.get("page") ?? "1", 10) || 1);

  const periodo = {
    gte: new Date(`${de}T00:00:00`),
    lte: new Date(`${ate}T23:59:59.999`),
  };
  const filtroBase = {
    createdAt: periodo,
    ...(q
      ? {
          OR: [
            { itemEstoque: { nome: { contains: q } } },
            { justificativa: { contains: q } },
            { nomeRetirante: { contains: q } },
            { autorizadoPor: { nome: { contains: q } } },
          ],
        }
      : {}),
  };
  const where = {
    ...filtroBase,
    ...(tipo === "ENTRADA" ? { quantidade: { gt: 0 } } : tipo === "SAIDA" ? { quantidade: { lt: 0 } } : {}),
  };

  const [total, movs, entradas, saidas] = await Promise.all([
    prisma.movimentacaoEstoque.count({ where }),
    prisma.movimentacaoEstoque.findMany({
      where,
      select: {
        id: true,
        quantidade: true,
        justificativa: true,
        nomeRetirante: true,
        createdAt: true,
        itemEstoque: { select: { id: true, nome: true } },
        autorizadoPor: { select: { nome: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.movimentacaoEstoque.aggregate({
      where: { ...filtroBase, quantidade: { gt: 0 } },
      _sum: { quantidade: true },
      _count: true,
    }),
    prisma.movimentacaoEstoque.aggregate({
      where: { ...filtroBase, quantidade: { lt: 0 } },
      _sum: { quantidade: true },
      _count: true,
    }),
  ]);

  return {
    movimentacoes: movs.map((m) => ({
      id: m.id,
      quantidade: m.quantidade,
      justificativa: m.justificativa,
      nomeRetirante: m.nomeRetirante,
      createdAt: m.createdAt.toISOString(),
      itemId: m.itemEstoque.id,
      itemNome: m.itemEstoque.nome,
      autorizadoPor: m.autorizadoPor?.nome ?? null,
    })),
    total,
    page,
    filtros: { q, tipo, de, ate },
    kpis: {
      entradasUnidades: entradas._sum.quantidade ?? 0,
      entradasRegistros: entradas._count,
      saidasUnidades: Math.abs(saidas._sum.quantidade ?? 0),
      saidasRegistros: saidas._count,
    },
  };
}

function fmt(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default function EstoqueMovimentacoes({ loaderData }: Route.ComponentProps) {
  const { movimentacoes, total, page, filtros, kpis } = loaderData;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const params = new URLSearchParams();
  if (filtros.q) params.set("q", filtros.q);
  if (filtros.tipo) params.set("tipo", filtros.tipo);
  params.set("de", filtros.de);
  params.set("ate", filtros.ate);

  return (
    <div className="space-y-6" data-od-id="movements-page">
      <Breadcrumb>
        <BreadcrumbItem href="/app/estoque">Estoque</BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem current>Movimentações</BreadcrumbItem>
      </Breadcrumb>

      <PageHeader
        eyebrow="Operações · Estoque"
        title="Movimentações"
        description="Rastreie entradas e saídas realizadas nos materiais."
        actions={
          <>
            <Button as={Link} to="/app/estoque/itens" variant="secondary">
              Ver itens
            </Button>
            <Button as={Link} to="/app/estoque" variant="primary">
              Nova movimentação
            </Button>
          </>
        }
      />

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3" aria-label="Resumo do período" data-od-id="movements-kpis">
        <KpiCard label="Entradas no período" value={kpis.entradasUnidades} hint={`${kpis.entradasRegistros} registros`} tone="success" icon={<Icon name="trending-up" size="md" />} />
        <KpiCard label="Saídas no período" value={kpis.saidasUnidades} hint={`${kpis.saidasRegistros} registros`} tone="warning" icon={<Icon name="trending-down" size="md" />} />
        <KpiCard label="Movimentações" value={kpis.entradasRegistros + kpis.saidasRegistros} hint="no período filtrado" tone="accent" icon={<Icon name="clipboard" size="md" />} />
      </section>

      <Form
        method="get"
        role="search"
        aria-label="Filtrar movimentações"
        className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_auto]"
        data-od-id="movements-filters"
      >
        <Input name="q" label="Buscar" type="search" placeholder="Item, motivo ou responsável" defaultValue={filtros.q ?? ""} />
        <Input name="de" label="De" type="date" defaultValue={filtros.de} />
        <Input name="ate" label="Até" type="date" defaultValue={filtros.ate} />
        <Select
          name="tipo"
          label="Tipo"
          defaultValue={filtros.tipo}
          options={[
            { value: "", label: "Todos" },
            { value: "ENTRADA", label: "Entrada" },
            { value: "SAIDA", label: "Saída" },
          ]}
        />
        <div className="flex gap-2">
          <Button type="submit" variant="secondary">
            Filtrar
          </Button>
          <Button as={Link} to="/app/estoque/movimentacoes" variant="ghost">
            Limpar
          </Button>
        </div>
      </Form>

      <Card padding="none" data-od-id="movements-table">
        <CardHeader title="Histórico de movimentações" description={`${total} ${total === 1 ? "registro" : "registros"} no período`} />
        <CardBody>
          {movimentacoes.length === 0 ? (
            <EmptyState
              icon={<Icon name="clipboard" size="lg" />}
              title="Nenhuma movimentação encontrada"
              description="Ajuste o período ou os filtros para ver outros registros."
            />
          ) : (
            <TableWrap>
              <Table>
                <caption className="sr-only">Histórico de movimentações de estoque</caption>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Quantidade</TableHead>
                    <TableHead>Motivo</TableHead>
                    <TableHead>Retirante</TableHead>
                    <TableHead>Autorizado por</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movimentacoes.map((m) => {
                    const entrada = m.quantidade > 0;
                    return (
                      <TableRow key={m.id}>
                        <TableCell className="whitespace-nowrap">{fmt(m.createdAt)}</TableCell>
                        <TableCell>
                          <Link to={`/app/estoque/${m.itemId}`} className="font-bold text-fg hover:text-accent">
                            {m.itemNome}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <Badge tone={entrada ? "success" : "danger"}>{entrada ? "Entrada" : "Saída"}</Badge>
                        </TableCell>
                        <TableCell className={`font-bold tabular-nums ${entrada ? "text-success" : "text-danger"}`}>
                          {entrada ? `+${m.quantidade}` : m.quantidade}
                        </TableCell>
                        <TableCell>{m.justificativa || <span className="text-muted">—</span>}</TableCell>
                        <TableCell>{m.nomeRetirante || <span className="text-muted">—</span>}</TableCell>
                        <TableCell>{m.autorizadoPor ?? <span className="text-muted">—</span>}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableWrap>
          )}
        </CardBody>
      </Card>

      {movimentacoes.length > 0 && (
        <Pagination
          current={page}
          total={totalPages}
          basePath="/app/estoque/movimentacoes"
          searchParams={params}
          totalItems={total}
          pageSize={PAGE_SIZE}
        />
      )}
    </div>
  );
}
