/**
 * Rota /app/financeiro — Dashboard Financeiro (S06-T10).
 *
 * **Camadas (defense in depth):**
 * - Loader (camada 2): `assertCanSeeFinancials(user)` — RBAC service-side.
 * - Service (camada 3): `getDashboardFinanceiro(user)` — agrega dados.
 * - UI (camada 1): `<KpiSaldoTotal>`, `<CardSaldoCaixa>`, `<UltimasMovimentacoes>`.
 *
 * **Ações condicionais:**
 * - '+ Nova Caixa' botão visível apenas para ADMIN/PASTOR/FINANCEIRO.
 * - SECRETARIO não vê coluna Membro em lançamentos (filtro service-side).
 *
 * @see app/lib/finance.server.ts (getDashboardFinanceiro)
 * @see app/lib/rbac.server.ts (assertCanSeeFinancials)
 */
import { Link } from "react-router";
import type { Route } from "./+types/financeiro._index";
import { userContext } from "~/lib/user-context";
import { assertCanSeeFinancials } from "~/lib/rbac.server";
import { getDashboardFinanceiro } from "~/lib/finance.server";
import { Can } from "~/components/Can";
import { KpiSaldoTotal } from "~/components/KpiSaldoTotal";
import { CardSaldoCaixa } from "~/components/CardSaldoCaixa";
import { AtalhoFinanceiro } from "~/components/AtalhoFinanceiro";
import { UltimasMovimentacoes } from "~/components/UltimasMovimentacoes";
import { PageHeader } from "~/components/PageHeader";

export function meta(_args: Route.MetaArgs) {
  return [{ title: "Financeiro — Igreja Conect" }];
}

/**
 * Loader do Dashboard Financeiro.
 *
 * 1. Lê o user do context (injetado pelo _middleware).
 * 2. Aplica RBAC (assertCanSeeFinancials — lança 403 se não pode).
 * 3. Chama getDashboardFinanceiro (service layer).
 *
 * @param args - LoaderFunctionArgs.
 * @returns Dados do dashboard.
 * @throws Response 403 se perfil não autorizado.
 */
export async function loader({ context }: Route.LoaderArgs) {
  const user = context.get(userContext);
  if (!user) {
    throw new Response("Não autenticado.", { status: 401 });
  }

  // Camada 2 (RBAC service-side) — assertCanSeeFinancials lança 403.
  assertCanSeeFinancials(user);

  // Camada 3 (dados) — getDashboardFinanceiro também aplica assertCanSeeFinancials
  // internamente (defense in depth), mas já validamos na camada 2.
  const data = await getDashboardFinanceiro(user);

  return { user, ...data };
}

/**
 * Página do Dashboard Financeiro.
 *
 * Layout: KPI no topo, grid de caixas no meio, atalhos e últimas
 * movimentações abaixo.
 */
export default function DashboardFinanceiro({
  loaderData,
}: Route.ComponentProps) {
  const {
    user,
    caixas,
    ultimosLancamentos,
    saldoAgregadoCentavos,
    totalCaixasAtivos,
  } = loaderData;

  const podeCriarLancamento = user.cargo
    ? ["ADMIN", "PASTOR", "FINANCEIRO"].includes(user.cargo)
    : false;

  const podeGerenciarCaixa = user.cargo
    ? ["ADMIN", "PASTOR", "FINANCEIRO"].includes(user.cargo)
    : false;

  // SECRETARIO não vê dízimos/membros nos lançamentos
  const podeVerMembro = user.cargo !== "SECRETARIO";

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <PageHeader
        title="Financeiro"
        action={
          <Can user={user} allow={["ADMIN", "PASTOR", "FINANCEIRO"]}>
            <Link
              to="/app/financeiro/caixas/novo"
              className="inline-flex items-center justify-center rounded-md bg-cyan-700 px-3 h-9 text-sm font-medium text-white hover:bg-cyan-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-700 focus-visible:ring-offset-2"
            >
              + Nova Caixa
            </Link>
          </Can>
        }
      />

      {/* KPI Saldo Total */}
      <KpiSaldoTotal
        saldoCentavos={saldoAgregadoCentavos}
        totalCaixas={totalCaixasAtivos}
        className="mb-6"
      />

      {/* Grid de caixas */}
      {caixas.length > 0 && (
        <section className="mb-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-3">
            Caixas Ativos
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {caixas.map((caixa) => (
              <CardSaldoCaixa
                key={caixa.id}
                caixa={caixa}
                podeCriarLancamento={podeCriarLancamento}
                user={user}
              />
            ))}
          </div>
        </section>
      )}

      {/* Atalhos */}
      <section className="mb-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-3">
          Ações Rápidas
        </h2>
        <div className="flex flex-wrap gap-2">
          <AtalhoFinanceiro
            label="Novo Lançamento"
            href="/app/financeiro/lancamentos/novo"
          />
          {podeGerenciarCaixa && (
            <AtalhoFinanceiro
              label="Gerenciar Caixas"
              href="/app/financeiro/caixas"
            />
          )}
        </div>
      </section>

      {/* Últimas Movimentações */}
      <section>
        <h2 className="text-lg font-semibold text-slate-900 mb-3">
          Últimas Movimentações
        </h2>
        <div className="bg-white rounded-lg border border-slate-200 p-2">
          <UltimasMovimentacoes
            items={ultimosLancamentos}
            podeVerMembro={podeVerMembro}
          />
        </div>
      </section>
    </div>
  );
}
