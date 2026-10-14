/**
 * Rota /app/patrimonio/:id — ficha do bem (`patrimonio-detalhe.html` do DS).
 *
 * Mostra dados do bem e o histórico de manutenções. As ações operacionais
 * (enviar para manutenção, registrar retorno, baixa por perda) continuam nas
 * rotas `/app/estoque/:id/*`, que já aplicam o RBAC e as regras RN-EST-03/05.
 * Vida útil restante e depreciação acumulada são estimativas lineares
 * calculadas a partir do valor, da data de aquisição e da vida útil
 * informados no cadastro. A auditoria do mockup ainda não existe no modelo.
 */
import { Link, redirect } from "react-router";
import BadgeStatusPatrimonio from "~/components/BadgeStatusPatrimonio";
import CardManutencao from "~/components/CardManutencao";
import {
  Badge,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbSeparator,
  Button,
  Card,
  CardBody,
  CardHeader,
  KpiCard,
  PageHeader,
} from "~/components/ds";
import { getItemEstoqueDetalhe } from "~/lib/itemEstoque.server";
import { formatBRLFromCents } from "~/lib/money-format";
import { assertCanManageEstoque } from "~/lib/rbac.server";
import { userContext } from "~/lib/user-context";
import type { Route } from "./+types/patrimonio.$id";

export function meta({ data }: Route.MetaArgs) {
  const nome = data?.item?.nome ?? "Patrimônio";
  return [{ title: `${nome} · Patrimônio · Igreja Conect` }];
}

export async function loader({ params, context }: Route.LoaderArgs) {
  const user = context.get(userContext);
  if (!user) throw new Response("Não autenticado.", { status: 401 });

  const item = await getItemEstoqueDetalhe(params.id, user);
  if (!item) throw new Response("Patrimônio não encontrado.", { status: 404 });
  // Itens de consumo têm a ficha própria no módulo de estoque.
  if (item.tipo !== "PATRIMONIO") throw redirect(`/app/estoque/${item.id}`);

  let podeGerenciar = true;
  try {
    assertCanManageEstoque(user);
  } catch {
    podeGerenciar = false;
  }

  return {
    podeGerenciar,
    item: {
      id: item.id,
      nome: item.nome,
      descricao: item.descricao,
      numeroSerie: item.numeroSerie,
      statusPatrimonio: item.statusPatrimonio,
      localizacaoFisica: item.localizacaoFisica,
      categoria: item.categoria,
      valorAquisicaoCentavos: item.valorAquisicaoCentavos,
      dataAquisicao: item.dataAquisicao?.toISOString() ?? null,
      notaFiscal: item.notaFiscal,
      fimGarantia: item.fimGarantia?.toISOString() ?? null,
      vidaUtilAnos: item.vidaUtilAnos,
      responsavelPatrimonio: item.responsavelPatrimonio,
      ativo: item.ativo,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
      manutencoes: item.manutencoes,
    },
  };
}

function fmt(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}

/** Vida útil restante (anos, ≥ 0) e depreciação linear acumulada em centavos. */
function calcularDepreciacao(item: {
  dataAquisicao: string | null;
  vidaUtilAnos: number | null;
  valorAquisicaoCentavos: number | null;
}): { anosRestantes: number; depreciadoCentavos: number } | null {
  if (!item.dataAquisicao || !item.vidaUtilAnos) return null;
  const decorridos = (Date.now() - new Date(item.dataAquisicao).getTime()) / (365.25 * 24 * 3600 * 1000);
  const proporcao = Math.min(1, Math.max(0, decorridos / item.vidaUtilAnos));
  return {
    anosRestantes: Math.max(0, Math.ceil(item.vidaUtilAnos - decorridos)),
    depreciadoCentavos: Math.round((item.valorAquisicaoCentavos ?? 0) * proporcao),
  };
}

export default function PatrimonioDetalhe({ loaderData }: Route.ComponentProps) {
  const { item, podeGerenciar } = loaderData;
  const emManutencao = item.statusPatrimonio === "EM_MANUTENCAO";
  const baixado = item.statusPatrimonio === "BAIXADO_PERDA" || !item.ativo;
  const depreciacao = calcularDepreciacao(item);
  const garantiaEncerrada = item.fimGarantia ? new Date(item.fimGarantia).getTime() < Date.now() : null;

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6 lg:p-8" data-od-id="asset-detail-page">
      <Breadcrumb>
        <BreadcrumbItem href="/app/patrimonio">Patrimônio</BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem current>{item.nome}</BreadcrumbItem>
      </Breadcrumb>

      <PageHeader
        eyebrow={item.numeroSerie ? `Patrimônio · ${item.numeroSerie}` : "Patrimônio"}
        title={item.nome}
        description={`Registrado em ${fmt(item.createdAt)}.`}
        actions={
          podeGerenciar && !baixado ? (
            <>
              {emManutencao ? (
                <Button as={Link} to={`/app/estoque/${item.id}/retorno`} variant="primary">
                  Registrar retorno
                </Button>
              ) : (
                <Button as={Link} to={`/app/estoque/${item.id}/manutencao`} variant="secondary">
                  Enviar para manutenção
                </Button>
              )}
              <Button as={Link} to={`/app/estoque/${item.id}/baixa`} variant="danger">
                Dar baixa
              </Button>
            </>
          ) : undefined
        }
      />

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Resumo do bem" data-od-id="asset-detail-kpis">
        <KpiCard
          label="Status"
          value={<BadgeStatusPatrimonio status={item.statusPatrimonio} />}
          hint={baixado ? "bem baixado" : emManutencao ? "fora de uso" : "sem pendências"}
          tone={emManutencao ? "warning" : baixado ? "danger" : "success"}
        />
        <KpiCard label="Localização" value={item.localizacaoFisica || "Não informada"} tone="info" />
        <KpiCard
          label="Valor de aquisição"
          value={item.valorAquisicaoCentavos != null ? formatBRLFromCents(item.valorAquisicaoCentavos) : "Não informado"}
          hint={item.categoria ?? undefined}
          tone="accent"
        />
        <KpiCard
          label="Vida útil"
          value={depreciacao ? `${depreciacao.anosRestantes} ${depreciacao.anosRestantes === 1 ? "ano" : "anos"}` : "Não informada"}
          hint={
            depreciacao && item.valorAquisicaoCentavos != null
              ? `depreciação estimada ${formatBRLFromCents(depreciacao.depreciadoCentavos)}`
              : "restantes"
          }
          tone="warning"
        />
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2" padding="none" data-od-id="asset-data">
          <CardHeader title="Dados do bem" description={`Atualizado em ${fmt(item.updatedAt)}`} />
          <CardBody>
            <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs font-bold uppercase tracking-wide text-muted">Número de patrimônio</dt>
                <dd className="mt-1 font-mono text-fg">{item.numeroSerie ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs font-bold uppercase tracking-wide text-muted">Localização atual</dt>
                <dd className="mt-1 text-fg">{item.localizacaoFisica || "Não informada"}</dd>
              </div>
              <div>
                <dt className="text-xs font-bold uppercase tracking-wide text-muted">Categoria</dt>
                <dd className="mt-1 text-fg">{item.categoria ?? "Não informada"}</dd>
              </div>
              <div>
                <dt className="text-xs font-bold uppercase tracking-wide text-muted">Responsável</dt>
                <dd className="mt-1 text-fg">{item.responsavelPatrimonio ?? "Não informado"}</dd>
              </div>
              <div>
                <dt className="text-xs font-bold uppercase tracking-wide text-muted">Data de aquisição</dt>
                <dd className="mt-1 text-fg">{item.dataAquisicao ? fmt(item.dataAquisicao) : "Não informada"}</dd>
              </div>
              <div>
                <dt className="text-xs font-bold uppercase tracking-wide text-muted">Nota fiscal</dt>
                <dd className="mt-1 text-fg">{item.notaFiscal ?? "Não informada"}</dd>
              </div>
              <div>
                <dt className="text-xs font-bold uppercase tracking-wide text-muted">Garantia</dt>
                <dd className="mt-1 text-fg">
                  {item.fimGarantia
                    ? `${garantiaEncerrada ? "Encerrada em" : "Até"} ${fmt(item.fimGarantia)}`
                    : "Não informada"}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-bold uppercase tracking-wide text-muted">Situação</dt>
                <dd className="mt-1">
                  <Badge tone={item.ativo ? "success" : "neutral"}>{item.ativo ? "Ativo" : "Arquivado"}</Badge>
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs font-bold uppercase tracking-wide text-muted">Observações</dt>
                <dd className="mt-1 whitespace-pre-line text-fg">{item.descricao ?? "Sem observações."}</dd>
              </div>
            </dl>
          </CardBody>
        </Card>

        <Card padding="none" data-od-id="asset-maintenance">
          <CardHeader title="Histórico de manutenção" />
          <CardBody>
            <CardManutencao
              manutencoes={item.manutencoes.map((m) => ({
                ...m,
                dataEnvio: new Date(m.dataEnvio),
                prazoTermino: m.prazoTermino ? new Date(m.prazoTermino) : null,
                dataRetorno: m.dataRetorno ? new Date(m.dataRetorno) : null,
              }))}
            />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
