/**
 * Rota /app/financeiro/transferencias/nova — Nova Transferência entre Caixas (S07-T04, rework S07).
 *
 * **Camadas (defense in depth):**
 * - Loader (camada 2): `assertCanTransferir(user)` — RBAC service-side.
 * - Action (camada 2): `assertCanTransferir(user)` — RBAC DENTRO da action (SEC-S07-005).
 * - Service (camada 3): validação Zod + $transaction atômica.
 *
 * **RBAC:** 3 perfis (ADMIN, PASTOR, FINANCEIRO). SECRETARIO bloqueado.
 * Camada 1 (UI) mostra mensagem amigável (não 403) para SECRETARIO.
 *
 * **SEC-S07-005:** Action agora chama `assertCanTransferir(user)` ANTES de chamar
 * o service — defense-in-depth: se o service for chamado diretamente (CLI/test),
 * ainda assim a action barra (camada 2).
 *
 * **Fluxo:**
 * - GET → loader retorna caixas → renderiza form
 * - POST erro → action retorna `{ errors }` → form exibe erros
 * - POST saldo insuficiente → `{ formError }` → mensagem amigável
 * - POST sucesso → redirect para /app/financeiro
 *
 * @see app/lib/rbac.server.ts (assertCanTransferir)
 * @see app/lib/transferencias.server.ts (transferirEntreCaixas)
 * @see app/lib/schemas/transferencias.ts (TransferenciaCreateSchema)
 * @see app/components/financeiro.transferencia.tsx (FormTransferencia)
 */
import { redirect, type LoaderFunctionArgs, type ActionFunctionArgs } from "react-router";
import { userContext } from "~/lib/user-context";
import { assertCanTransferir } from "~/lib/rbac.server";
import { listarCaixasParaTransferencia } from "~/lib/caixas.server";
import { transferirEntreCaixas } from "~/lib/transferencias.server";
import { parseBRLToCents } from "~/lib/money-format";
import { Can } from "~/components/Can";
import { PageHeader } from "~/components/PageHeader";
import { FormTransferencia } from "~/components/financeiro.transferencia";
import type { CaixaOption } from "~/components/financeiro.transferencia";

// Types for loader/action
type LoaderData = {
  user: { id: string; nome: string; cargo: string | null };
  caixas: CaixaOption[];
};

export function meta() {
  return [{ title: "Nova Transferência — Igreja Conect" }];
}

/**
 * Loader — verifica RBAC e retorna caixas disponíveis.
 *
 * 1. Lê user do context (injetado pelo _middleware).
 * 2. Aplica assertCanTransferir (camada 2) — lança 403 se não autorizado.
 * 3. Lista caixas para transferência (camada 3) — também aplica assertCanTransferir.
 *
 * @param args - LoaderFunctionArgs.
 * @returns {Promise<LoaderData>} Dados para renderização.
 * @throws {Response} 403 se cargo não está em TRANSFERENCIA_CARGOS.
 */
export async function loader({ context }: LoaderFunctionArgs): Promise<LoaderData> {
  const user = context.get(userContext);
  if (!user) {
    throw new Response("Não autenticado.", { status: 401 });
  }

  // Camada 2: assertCanTransferir (sincroniza com camada 3)
  assertCanTransferir(user);

  // Camada 3: listarCaixasParaTransferencia (já chama assertCanTransferir internamente)
  const caixas = await listarCaixasParaTransferencia(user);

  return { user, caixas };
}

/**
 * Action — processa formulário de transferência.
 *
 * **SEC-S07-005 Defense-in-depth (camada 2 RBAC):**
 *   1. Extrai user do context.
 *   2. `assertCanTransferir(user)` — LANÇA 403 ANTES de qualquer processamento.
 *   3. Extrai campos do FormData.
 *   4. Converte valor BRL → centavos.
 *   5. Chama transferirEntreCaixas (camada 3) — valida Zod + atomicidade.
 *   6. Sucesso → redirect.
 *   7. Erro de validação → retorna { errors }.
 *   8. Erro de negócio (saldo) → retorna { formError }.
 *
 * @param args - ActionFunctionArgs.
 * @returns Redirect em sucesso, ou dados de erro.
 * @throws {Response} 403 se cargo não está em TRANSFERENCIA_CARGOS.
 */
export async function action({ request, context }: ActionFunctionArgs) {
  const user = context.get(userContext);
  if (!user) {
    throw new Response("Não autenticado.", { status: 401 });
  }

  // SEC-S07-005: Camada 2 RBAC ANTES de qualquer processamento (defense-in-depth)
  assertCanTransferir(user);

  const formData = await request.formData();
  const origemId = formData.get("origemId") as string | null;
  const destinoId = formData.get("destinoId") as string | null;
  const valorDisplay = formData.get("valorDisplay") as string | null;
  const descricao = formData.get("descricao") as string | null;
  const idempotencyKey = formData.get("idempotencyKey") as string | null;

  // Converter valor BRL para centavos
  const valorCentavos = parseBRLToCents(valorDisplay ?? "");

  // Validar campos obrigatórios
  const errors: Record<string, string> = {};
  if (!origemId) {
    errors.origemId = "Selecione o caixa de origem.";
  }
  if (!destinoId) {
    errors.destinoId = "Selecione o caixa de destino.";
  }
  if (!valorCentavos || valorCentavos <= 0) {
    errors.valorCentavos = "Informe um valor maior que zero.";
  }
  if (origemId && destinoId && origemId === destinoId) {
    errors.destinoId = "Origem e destino não podem ser o mesmo caixa.";
  }

  if (Object.keys(errors).length > 0) {
    return Response.json(
      {
        errors,
        fields: { origemId: origemId ?? undefined, destinoId: destinoId ?? undefined, valorCentavos: valorCentavos ? String(valorCentavos) : undefined, descricao: descricao ?? undefined },
      },
      { status: 400 }
    );
  }

  // Chamar service (camada 3 — também valida RBAC internamente)
  try {
    await transferirEntreCaixas(
      {
        origemId: origemId!,
        destinoId: destinoId!,
        valorCentavos: valorCentavos!,
        descricao: descricao || undefined,
        data: new Date(),
        idempotencyKey: idempotencyKey || undefined,
      },
      user
    );
  } catch (err) {
    // Tratar erros de negócio (saldo insuficiente, etc.)
    if (err instanceof Response) {
      // Erro de validação Zod (400) ou saldo (409)
      const status = err.status;
      const message = await err.text();

      if (status === 400) {
        // Erro de validação Zod — retornar erros de campo
        try {
          const issues = JSON.parse(message);
          const fieldErrors: Record<string, string> = {};
          for (const issue of issues) {
            const path = issue.path[0];
            if (typeof path === "string") {
              fieldErrors[path] = issue.message;
            }
          }
          return Response.json(
            {
              errors: fieldErrors,
              fields: { origemId, destinoId, valorCentavos: String(valorCentavos), descricao },
            },
            { status: 400 }
          );
        } catch {
          // Se não for JSON, retorna erro genérico
          return Response.json(
            { formError: message, fields: { origemId, destinoId, valorCentavos: String(valorCentavos), descricao } },
            { status }
          );
        }
      }

      if (status === 409) {
        // Erro de saldo ou caixa arquivado — mensagem amigável
        return Response.json(
          { formError: message, fields: { origemId, destinoId, valorCentavos: String(valorCentavos), descricao } },
          { status: 409 }
        );
      }
    }
    throw err;
  }

  // Sucesso — redirect para dashboard com feedback
  return redirect("/app/financeiro?transferencia=ok");
}

/**
 * Página de Nova Transferência.
 *
 * Mostra form apenas para ADMIN/PASTOR/FINANCEIRO.
 * SECRETARIO vê mensagem amigável (não 403 — Camada 1 pode掩藏).
 */
export default function NovaTransferencia({
  loaderData,
  actionData,
}: {
  loaderData: LoaderData;
  actionData?: unknown;
}) {
  const { user, caixas } = loaderData;

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto">
      <PageHeader
        title="Nova Transferência"
        breadcrumb={
          <nav aria-label="Breadcrumb" className="text-sm text-slate-500">
            <ol className="flex items-center gap-1">
              <li><a href="/app/financeiro" className="hover:text-cyan-700">Financeiro</a></li>
              <li aria-hidden="true">/</li>
              <li aria-current="page">Nova Transferência</li>
            </ol>
          </nav>
        }
      />

      <Can
        user={user}
        allow={["ADMIN", "PASTOR", "FINANCEIRO"]}
        fallback={
          <div className="rounded-lg bg-slate-50 border border-slate-200 p-6 text-center">
            <p className="text-slate-600">
              Você não tem permissão para realizar transferências entre caixas.
            </p>
            <a
              href="/app/financeiro"
              className="mt-4 inline-flex items-center text-sm text-cyan-700 hover:text-cyan-800"
            >
              ← Voltar ao Financeiro
            </a>
          </div>
        }
      >
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <FormTransferencia
            caixas={caixas}
            actionData={actionData as Parameters<typeof FormTransferencia>[0]["actionData"]}
          />
        </div>

        <div className="mt-4 text-center">
          <a
            href="/app/financeiro"
            className="text-sm text-slate-500 hover:text-cyan-700"
          >
            ← Voltar ao Financeiro
          </a>
        </div>
      </Can>
    </div>
  );
}
