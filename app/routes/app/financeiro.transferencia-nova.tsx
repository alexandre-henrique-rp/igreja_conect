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
import { Link, redirect, useActionData, useLoaderData, useNavigation, type LoaderFunctionArgs, type ActionFunctionArgs } from "react-router";
import { useEffect, useRef, useState } from "react";
import { userContext } from "~/lib/user-context";
import { assertCanTransferir } from "~/lib/rbac.server";
import { listarCaixasParaTransferencia } from "~/lib/caixas.server";
import { transferirEntreCaixas } from "~/lib/transferencias.server";
import { parseBRLToCents } from "~/lib/money-format";
import { Can } from "~/components/Can";
import { Button } from "~/components/Button";
import { Input } from "~/components/Input";
import { MoneyInput } from "~/components/MoneyInput";
import { Select } from "~/components/Select";
import { formatBRLFromCents } from "~/lib/money-format";

// Types for loader/action
type CaixaOption = {
  id: string;
  nome: string;
  saldoCentavos: number;
};

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

/** Resposta da action — mantém compatibilidade com action existente. */
type ActionData = {
  errors?: Record<string, string>;
  formError?: string;
  fields?: {
    origemId?: string;
    destinoId?: string;
    valorCentavos?: string;
    descricao?: string;
    idempotencyKey?: string;
  };
};

/**
 * Página de Nova Transferência — layout alinhado ao Novo Lançamento.
 *
 * Mostra form apenas para ADMIN/PASTOR/FINANCEIRO.
 * SECRETARIO vê mensagem amigável.
 */
export default function NovaTransferencia() {
  const { user, caixas } = useLoaderData<typeof loader>();
  const actionData = useActionData<ActionData>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const firstErrorRef = useRef<HTMLSelectElement | HTMLInputElement | null>(null);

  // SEC-S07-003: idempotency key gerada no cliente
  const [idempotencyKey] = useState<string>(
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : (actionData?.fields?.idempotencyKey ?? "")
  );

  const errors = actionData?.errors ?? {};
  const formError = actionData?.formError;
  const fields = actionData?.fields ?? {};

  const caixaOptions = caixas.map((c) => ({
    value: c.id,
    label: `${c.nome} — ${formatBRLFromCents(c.saldoCentavos)}`,
  }));

  useEffect(() => {
    if (!isSubmitting && firstErrorRef.current) {
      firstErrorRef.current.focus();
    }
  }, [isSubmitting]);

  const setOrigemRef = (el: HTMLSelectElement | null) => {
    if (errors.origemId) firstErrorRef.current = el;
  };
  const setDestinoRef = (el: HTMLSelectElement | null) => {
    if (errors.destinoId && !firstErrorRef.current) firstErrorRef.current = el;
  };
  const setValorRef = (el: HTMLInputElement | null) => {
    if (errors.valorCentavos && !firstErrorRef.current) firstErrorRef.current = el;
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <Can
        user={user}
        allow={["ADMIN", "PASTOR", "FINANCEIRO"]}
        fallback={
          <div className="rounded-lg bg-slate-50 border border-slate-200 p-6 text-center">
            <p className="text-slate-600">
              Você não tem permissão para realizar transferências entre caixas.
            </p>
            <Link
              to="/app/financeiro"
              className="mt-4 inline-flex items-center text-sm text-cyan-700 hover:text-cyan-800"
            >
              ← Voltar ao Financeiro
            </Link>
          </div>
        }
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Nova Transferência</h1>
            <p className="text-slate-600 mt-1">Mova valores entre contas de forma segura e auditada.</p>
          </div>
          <Button as={Link} to="/app/financeiro" variant="secondary" size="sm">
            Cancelar
          </Button>
        </div>

        {caixas.length < 2 && (
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-6 mb-6">
            <p className="text-sm text-amber-800">
              É necessário ter <strong>pelo menos 2 caixas ativos</strong> para fazer uma transferência.
            </p>
            <Link
              to="/app/financeiro/caixas/novo"
              className="mt-3 inline-flex items-center rounded-md bg-amber-100 px-3 py-1.5 text-sm font-medium text-amber-900 hover:bg-amber-200 transition-colors"
            >
              + Criar novo caixa
            </Link>
          </div>
        )}

        <form method="POST" noValidate className="space-y-6">
          {formError && (
            <div role="alert" className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800">
              {formError}
            </div>
          )}

          {/* SEC-S07-003: Idempotency key */}
          <input type="hidden" name="idempotencyKey" value={idempotencyKey} />

          {/* Informações Básicas */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center gap-2">
              <svg className="h-5 w-5 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 16v-4M12 8h.01" />
              </svg>
              <h2 className="font-semibold text-slate-900">Informações Básicas</h2>
            </div>
            <div className="p-6 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div ref={setOrigemRef as never}>
                  <Select
                    name="origemId"
                    label="Conta de Origem"
                    placeholder="Selecione"
                    options={caixaOptions}
                    defaultValue={fields.origemId ?? ""}
                    required
                  />
                  {errors.origemId && <p role="alert" className="text-sm text-red-700 mt-1">{errors.origemId}</p>}
                </div>
                <div ref={setDestinoRef as never}>
                  <Select
                    name="destinoId"
                    label="Conta de Destino"
                    placeholder="Selecione"
                    options={caixaOptions}
                    defaultValue={fields.destinoId ?? ""}
                    required
                  />
                  {errors.destinoId && <p role="alert" className="text-sm text-red-700 mt-1">{errors.destinoId}</p>}
                </div>
              </div>

              <div ref={setValorRef as never}>
                <MoneyInput
                  name="valorDisplay"
                  label="Valor (R$)"
                  defaultValue={
                    fields.valorCentavos
                      ? String(Number(fields.valorCentavos) / 100).replace(".", ",")
                      : ""
                  }
                  error={errors.valorCentavos}
                  required
                />
                {errors.valorCentavos && <p role="alert" className="text-sm text-red-700 mt-1">{errors.valorCentavos}</p>}
              </div>
            </div>
          </div>

          {/* Observações */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center gap-2">
              <svg className="h-5 w-5 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              <h2 className="font-semibold text-slate-900">Observações</h2>
            </div>
            <div className="p-6 space-y-5">
              <Input
                name="descricao"
                label="Descrição (Opcional)"
                type="text"
                defaultValue={fields.descricao ?? ""}
                error={errors.descricao}
                hint="Máximo 200 caracteres"
                maxLength={200}
              />
            </div>
          </div>

          {/* Ações */}
          <div className="flex items-center gap-3">
            <Button type="submit" loading={isSubmitting} className="flex-1">
              {isSubmitting ? "Transferindo..." : "Transferir"}
            </Button>
            <Button as={Link} to="/app/financeiro" variant="secondary">
              Cancelar
            </Button>
          </div>
        </form>
      </Can>
    </div>
  );
}
