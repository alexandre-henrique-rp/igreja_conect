/**
 * Rota /app/financeiro/transferencias/:id — Detalhe de Transferência (Onda 2c).
 *
 * Exibe dados completos da transferência entre caixas:
 * origem, destino, valor, operador, idempotency key, descrição.
 *
 * **RBAC:** `assertCanSeeFinancialModule` (ADMIN/PASTOR/FINANCEIRO/SECRETARIO).
 * SECRETARIO não vê dízimos — mas transferência nunca é dízimo.
 *
 * **Comprovante bancário:** Onda 3a (schema + endpoint).
 * Por enquanto placeholder visual "Em breve".
 *
 * @see app/lib/transferencias.server.ts
 */
import { Link } from "react-router";
import type { Route } from "./+types/financeiro.transferencias.$id";
import { userContext } from "~/lib/user-context";
import { prisma } from "~/db/prisma.server";
import { assertCanSeeFinancialModule } from "~/lib/rbac.server";
import { formatBRLFromCents } from "~/lib/money-format";
import { Breadcrumb } from "~/components/Breadcrumb";
import { PageHeader } from "~/components/PageHeader";
import { Button } from "~/components/Button";
import { ErrorAlert } from "~/components/ErrorAlert";

export function meta({ data }: Route.MetaArgs) {
  if (!data?.transferencia) {
    return [{ title: "Transferência não encontrada — Igreja Conect" }];
  }
  return [
    {
      title: `Transferência #${data.transferencia.id.slice(0, 8)} — Igreja Conect`,
    },
  ];
}

/**
 * Loader: busca transferência por id + caixas/operador relacionados.
 */
export async function loader({ params, context }: Route.LoaderArgs) {
  const user = context.get(userContext);
  if (!user) throw new Response("Não autenticado.", { status: 401 });
  assertCanSeeFinancialModule(user);

  const transferencia = await prisma.transferenciaCaixa.findUnique({
    where: { id: params.id },
    include: {
      caixaOrigem: { select: { id: true, nome: true, saldoCentavos: true } },
      caixaDestino: { select: { id: true, nome: true, saldoCentavos: true } },
      executadoPor: { select: { id: true, nome: true, cargo: true } },
    },
  });

  if (!transferencia) {
    throw new Response("Transferência não encontrada.", { status: 404 });
  }

  return { user, transferencia };
}

/**
 * Formata data/hora para PT-BR (dd/mm/aaaa hh:mm).
 */
function formatDateTime(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function TransferenciaDetail({
  loaderData,
}: Route.ComponentProps) {
  const { transferencia } = loaderData;

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      <Breadcrumb
        items={[
          { label: "Financeiro", href: "/app/financeiro" },
          {
            label: "Transferências",
            href: "/app/financeiro/transferencias",
          },
          { label: `#${transferencia.id.slice(0, 8)}` },
        ]}
      />

      <PageHeader
        title={`Transferência #${transferencia.id.slice(0, 8)}`}
        action={
          <Button as={Link} to="/app/financeiro/transferencias" variant="ghost">
            ← Lista
          </Button>
        }
      />

      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm mb-4">
        {/* Header com valor + data */}
        <header className="flex items-start justify-between mb-6 pb-6 border-b border-slate-100">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">
              Valor transferido
            </p>
            <p className="text-4xl font-extrabold text-slate-900 tracking-tight">
              {formatBRLFromCents(transferencia.valorCentavos)}
            </p>
            <p className="text-xs text-slate-400 mt-1 font-mono">
              {transferencia.valorCentavos} centavos
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">
              Data / Hora
            </p>
            <p className="text-sm font-medium text-slate-900">
              {formatDateTime(transferencia.dataHora)}
            </p>
          </div>
        </header>

        {/* Origem → Destino */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="p-4 rounded-xl bg-rose-50/40 border border-rose-100">
            <p className="text-[10px] uppercase tracking-widest font-bold text-rose-700 mb-2">
              Origem (saída)
            </p>
            <Link
              to={`/app/financeiro/caixas/${transferencia.caixaOrigem.id}`}
              className="block"
            >
              <p className="text-base font-bold text-slate-900 hover:text-cyan-700">
                {transferencia.caixaOrigem.nome}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                Saldo atual: {formatBRLFromCents(transferencia.caixaOrigem.saldoCentavos)}
              </p>
            </Link>
          </div>

          <div className="p-4 rounded-xl bg-emerald-50/40 border border-emerald-100">
            <p className="text-[10px] uppercase tracking-widest font-bold text-emerald-700 mb-2">
              Destino (entrada)
            </p>
            <Link
              to={`/app/financeiro/caixas/${transferencia.caixaDestino.id}`}
              className="block"
            >
              <p className="text-base font-bold text-slate-900 hover:text-cyan-700">
                {transferencia.caixaDestino.nome}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                Saldo atual: {formatBRLFromCents(transferencia.caixaDestino.saldoCentavos)}
              </p>
            </Link>
          </div>
        </div>

        {/* Metadados */}
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm border-t border-slate-100 pt-5">
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500 mb-1">
              Operador
            </dt>
            <dd className="text-slate-900">
              {transferencia.executadoPor.nome}
              <span className="text-xs text-slate-400 ml-2">
                ({transferencia.executadoPor.cargo ?? "—"})
              </span>
            </dd>
          </div>

          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500 mb-1">
              ID interno
            </dt>
            <dd className="text-xs text-slate-600 font-mono">
              #{transferencia.id}
            </dd>
          </div>

          {transferencia.descricao && (
            <div className="sm:col-span-2">
              <dt className="text-xs uppercase tracking-wide text-slate-500 mb-1">
                Descrição / Motivo
              </dt>
              <dd className="text-sm text-slate-700 whitespace-pre-wrap">
                {transferencia.descricao}
              </dd>
            </div>
          )}

          {transferencia.idempotencyKey && (
            <div className="sm:col-span-2">
              <dt className="text-xs uppercase tracking-wide text-slate-500 mb-1">
                Idempotency Key
              </dt>
              <dd className="text-xs text-slate-600 font-mono break-all">
                {transferencia.idempotencyKey}
              </dd>
              <p className="text-[10px] text-slate-400 mt-1">
                Garante que cliques duplicados não geram transferências duplicadas.
              </p>
            </div>
          )}
        </dl>
      </div>

      {/* Comprovante (placeholder até Onda 3a) */}
      <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <h3 className="text-base font-bold text-slate-900 mb-3">
          Comprovante Bancário
        </h3>
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-900">
          <p className="font-medium">Em breve — Onda 3a</p>
          <p className="text-xs mt-1">
            Upload de comprovante (slip do banco) vinculado a esta transferência.
            Modelo 1:1 com Upload.contextType = "transferencia.comprovante".
          </p>
        </div>
      </section>
    </div>
  );
}

/**
 * ErrorBoundary para 404 / 403.
 */
export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Erro ao carregar transferência.";
  if (error instanceof Response) {
    if (error.status === 404) {
      message = "Transferência não encontrada.";
    } else {
      message = error.statusText || message;
    }
  } else if (error instanceof Error) {
    message = error.message;
  }
  return (
    <main className="p-4 sm:p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-900 mb-2">Erro</h1>
      <ErrorAlert tone="error">{message}</ErrorAlert>
      <div className="mt-4">
        <Button as={Link} to="/app/financeiro/transferencias" variant="ghost">
          ← Lista de Transferências
        </Button>
      </div>
    </main>
  );
}
