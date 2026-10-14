/**
 * Rota /app/estoque/itens — lista de materiais (`estoque-itens.html` do DS).
 *
 * Itens de consumo ativos, com níveis calculados a partir de `quantidade` e
 * `quantidadeMinima`:
 *  - Crítico: quantidade 0
 *  - Baixo: 0 < quantidade ≤ mínimo
 *  - Normal: quantidade > mínimo
 *
 * Filtros por categoria e local (`localizacaoFisica`). O código do mockup não
 * existe no modelo. Patrimônio fica em `/app/patrimonio`.
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
import { assertCanManageEstoque, assertCanSeeEstoque } from "~/lib/rbac.server";
import { userContext } from "~/lib/user-context";
import type { Route } from "./+types/estoque.itens";

const PAGE_SIZE = 25;

type Nivel = "NORMAL" | "BAIXO" | "CRITICO";

const NIVEL: Record<Nivel, { label: string; tone: "success" | "warning" | "danger" }> = {
  NORMAL: { label: "Normal", tone: "success" },
  BAIXO: { label: "Baixo", tone: "warning" },
  CRITICO: { label: "Crítico", tone: "danger" },
};

function nivelDe(quantidade: number, minima: number): Nivel {
  if (quantidade <= 0) return "CRITICO";
  if (quantidade <= minima) return "BAIXO";
  return "NORMAL";
}

export function meta(_args: Route.MetaArgs) {
  return [{ title: "Itens do estoque · Igreja Conect" }];
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const user = context.get(userContext);
  if (!user) throw new Response("Não autenticado.", { status: 401 });
  assertCanSeeEstoque(user);

  let podeMovimentar = true;
  try {
    assertCanManageEstoque(user);
  } catch {
    podeMovimentar = false;
  }

  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 100) || undefined;
  const local = (url.searchParams.get("local") ?? "").trim() || undefined;
  const categoria = (url.searchParams.get("categoria") ?? "").trim() || undefined;
  const nivelParam = url.searchParams.get("status") ?? "";
  const nivel: Nivel | "" = nivelParam in NIVEL ? (nivelParam as Nivel) : "";
  const apenasBaixo = url.searchParams.get("aba") === "baixo";
  const page = Math.max(1, Number.parseInt(url.searchParams.get("page") ?? "1", 10) || 1);

  // Nível depende de comparar duas colunas (não suportado no where do Prisma):
  // carrega os itens ativos de consumo (volume pequeno) e filtra/pagina aqui.
  const todos = await prisma.itemEstoque.findMany({
    where: {
      tipo: "CONSUMO",
      ativo: true,
      ...(q ? { OR: [{ nome: { contains: q } }, { descricao: { contains: q } }] } : {}),
    },
    select: { id: true, nome: true, quantidade: true, quantidadeMinima: true, localizacaoFisica: true, categoria: true },
    orderBy: { nome: "asc" },
    take: 2000,
  });

  const locais = [...new Set(todos.map((i) => i.localizacaoFisica).filter((l): l is string => !!l))].sort((a, b) =>
    a.localeCompare(b, "pt-BR"),
  );
  const categorias = [...new Set(todos.map((i) => i.categoria).filter((c): c is string => !!c))].sort((a, b) =>
    a.localeCompare(b, "pt-BR"),
  );
  const comNivel = todos.map((i) => ({ ...i, nivel: nivelDe(i.quantidade, i.quantidadeMinima) }));
  const totalBaixo = comNivel.filter((i) => i.nivel !== "NORMAL").length;

  const filtrados = comNivel.filter(
    (i) =>
      (!local || i.localizacaoFisica === local) &&
      (!categoria || i.categoria === categoria) &&
      (!nivel || i.nivel === nivel) &&
      (!apenasBaixo || i.nivel !== "NORMAL"),
  );

  return {
    itens: filtrados.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    total: filtrados.length,
    totalGeral: comNivel.length,
    totalBaixo,
    page,
    locais,
    categorias,
    filtros: { q, local, categoria, nivel, apenasBaixo },
    podeMovimentar,
  };
}

export default function EstoqueItens({ loaderData }: Route.ComponentProps) {
  const { itens, total, totalGeral, totalBaixo, page, locais, categorias, filtros, podeMovimentar } = loaderData;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const params = new URLSearchParams();
  if (filtros.q) params.set("q", filtros.q);
  if (filtros.local) params.set("local", filtros.local);
  if (filtros.categoria) params.set("categoria", filtros.categoria);
  if (filtros.nivel) params.set("status", filtros.nivel);
  if (filtros.apenasBaixo) params.set("aba", "baixo");
  const temFiltro = Boolean(filtros.q || filtros.local || filtros.categoria || filtros.nivel);

  const aba = (baixo: boolean) => {
    const p = new URLSearchParams(params);
    if (baixo) p.set("aba", "baixo");
    else p.delete("aba");
    p.delete("page");
    const qs = p.toString();
    return qs ? `/app/estoque/itens?${qs}` : "/app/estoque/itens";
  };

  return (
    <div className="space-y-6" data-od-id="estoque-items-page">
      <Breadcrumb>
        <BreadcrumbItem href="/app/estoque">Estoque</BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem current>Itens</BreadcrumbItem>
      </Breadcrumb>

      <PageHeader
        eyebrow="Operações · Estoque"
        title="Itens do estoque"
        description="Acompanhe os materiais e seus níveis por local."
        actions={
          <>
            <Button as={Link} to="/app/estoque/movimentacoes" variant="secondary">
              Ver movimentações
            </Button>
            {podeMovimentar && (
              <Button as={Link} to="/app/estoque/novo" variant="primary">
                Novo item
              </Button>
            )}
          </>
        }
      />

      <Form
        method="get"
        role="search"
        aria-label="Filtrar itens"
        className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_auto]"
        data-od-id="estoque-items-filters"
      >
        {filtros.apenasBaixo && <input type="hidden" name="aba" value="baixo" />}
        <Input name="q" label="Buscar item" type="search" placeholder="Nome ou descrição" defaultValue={filtros.q ?? ""} />
        <Select
          name="categoria"
          label="Categoria"
          defaultValue={filtros.categoria ?? ""}
          options={[{ value: "", label: "Todas" }, ...categorias.map((c) => ({ value: c, label: c }))]}
        />
        <Select
          name="local"
          label="Local"
          defaultValue={filtros.local ?? ""}
          options={[{ value: "", label: "Todos" }, ...locais.map((l) => ({ value: l, label: l }))]}
        />
        <Select
          name="status"
          label="Status"
          defaultValue={filtros.nivel}
          options={[
            { value: "", label: "Todos" },
            ...(Object.keys(NIVEL) as Nivel[]).map((n) => ({ value: n, label: NIVEL[n].label })),
          ]}
        />
        <div className="flex gap-2">
          <Button type="submit" variant="secondary">
            Filtrar
          </Button>
          {(temFiltro || filtros.apenasBaixo) && (
            <Button as={Link} to="/app/estoque/itens" variant="ghost">
              Limpar filtros
            </Button>
          )}
        </div>
      </Form>

      <Card padding="none" data-od-id="estoque-items-table">
        <CardHeader title="Todos os itens" description={`${total} de ${totalGeral} itens`} />
        <CardBody>
          <nav aria-label="Visão da lista" className="mb-4 flex gap-2">
            {[
              { baixo: false, label: "Todos" },
              { baixo: true, label: `Estoque baixo (${totalBaixo})` },
            ].map((t) => (
              <Link
                key={t.label}
                to={aba(t.baixo)}
                aria-current={filtros.apenasBaixo === t.baixo ? "page" : undefined}
                className={
                  filtros.apenasBaixo === t.baixo
                    ? "rounded-full bg-accent-soft px-3 py-1.5 text-xs font-bold text-accent-strong"
                    : "rounded-full px-3 py-1.5 text-xs font-bold text-muted hover:bg-surface-3 hover:text-fg"
                }
              >
                {t.label}
              </Link>
            ))}
          </nav>

          {itens.length === 0 ? (
            <EmptyState
              icon={<Icon name="package" size="lg" />}
              title={temFiltro || filtros.apenasBaixo ? "Nenhum item encontrado" : "Nenhum item cadastrado"}
              description={
                temFiltro || filtros.apenasBaixo
                  ? "Ajuste os filtros para ver outros itens."
                  : "Cadastre o primeiro material para acompanhar os níveis."
              }
            />
          ) : (
            <TableWrap>
              <Table>
                <caption className="sr-only">Itens de estoque</caption>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Local</TableHead>
                    <TableHead>Quantidade</TableHead>
                    <TableHead>Nível mínimo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {itens.map((i) => (
                    <TableRow key={i.id}>
                      <TableCell>
                        <Link to={`/app/estoque/${i.id}`} className="font-bold text-fg hover:text-accent">
                          {i.nome}
                        </Link>
                      </TableCell>
                      <TableCell>{i.categoria || <span className="text-muted">—</span>}</TableCell>
                      <TableCell>{i.localizacaoFisica || <span className="text-muted">Não informado</span>}</TableCell>
                      <TableCell className="font-bold tabular-nums">{i.quantidade}</TableCell>
                      <TableCell className="tabular-nums text-muted">{i.quantidadeMinima}</TableCell>
                      <TableCell>
                        <Badge tone={NIVEL[i.nivel].tone}>{NIVEL[i.nivel].label}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-3">
                          <Link
                            to={`/app/estoque/${i.id}`}
                            className="text-sm font-bold text-accent-strong hover:underline"
                            aria-label={`Ver ${i.nome}`}
                          >
                            Ver
                          </Link>
                          {podeMovimentar && (
                            <Link
                              to={`/app/estoque/${i.id}/movimentar`}
                              className="text-sm font-bold text-accent-strong hover:underline"
                              aria-label={`Movimentar ${i.nome}`}
                            >
                              Movimentar
                            </Link>
                          )}
                        </div>
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
          basePath="/app/estoque/itens"
          searchParams={params}
          totalItems={total}
          pageSize={PAGE_SIZE}
        />
      )}
    </div>
  );
}
