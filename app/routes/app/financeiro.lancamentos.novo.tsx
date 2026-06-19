/**
 * Rota /app/financeiro/lancamentos/novo — Criar Lançamento Financeiro (S06-T13).
 *
 * **Loader:**
 * - `assertCanSeeFinancialModule(user)` — Camada 2 RBAC.
 * - Busca caixas ativos e membros para os selects do formulário.
 * - Se `?caixaId=` na URL, pré-seleciona o caixa.
 *
 * **Action:**
 * - Parseia `valorDisplay` (BRL) → centavos via `parseBRLToCents`.
 * - Valida com `LancamentoCreateSchema` (Zod) → 422 se inválido.
 * - Cria lançamento e atualiza saldo do caixa.
 * - P2003 (FK) → 422. Sucesso → 302 redirect para detalhe do caixa.
 *
 * @see app/lib/schemas/lancamentos.ts
 * @see docs/REGRAS_DE_NEGOCIO.md (RN-FIN-05)
 */
import { data, redirect, useActionData } from "react-router";
import { ZodError } from "zod";
import type { Route } from "./+types/financeiro.lancamentos.novo";
import { userContext } from "~/lib/user-context";
import { assertCanSeeFinancialModule } from "~/lib/rbac.server";
import { parseBRLToCents } from "~/lib/money-format";
import { LancamentoCreateSchema } from "~/lib/schemas/lancamentos";
import { criarLancamento } from "~/lib/lancamentos.server";
import { listarCaixasParaSelect } from "~/lib/caixas.server";
import { listarMembrosParaSelect } from "~/lib/members.server";
import { FormLancamento } from "~/components/FormLancamento";

export function meta(_args: Route.MetaArgs) {
  return [{ title: "Novo Lançamento — Igreja Conect" }];
}

/**
 * Loader: fornece dados para os selects do formulário.
 */
export async function loader({ request, context }: Route.LoaderArgs) {
  const user = context.get(userContext);
  if (!user) throw new Response("Não autenticado.", { status: 401 });
  assertCanSeeFinancialModule(user);

  const url = new URL(request.url);

  // Caixas ativos via service (SEC-004)
  const caixas = await listarCaixasParaSelect(user);

  // Membros para select via service (SEC-004)
  const membros = await listarMembrosParaSelect(user);

  // Se houver caixaId na query, pré-seleciona
  const caixaId = url.searchParams.get("caixaId") ?? "";

  return { caixas, membros, caixaIdPreSelected: caixaId };
}

/**
 * Converte raw form data em fieldErrors e defaultValues.
 */
function zodErrorsToMap(errors: ZodError["issues"]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const issue of errors) {
    const path = issue.path.join(".");
    if (path && !map[path]) {
      map[path] = issue.message;
    }
  }
  return map;
}

/**
 * Action: processa criação do lançamento.
 */
export async function action({ request, context }: Route.ActionArgs) {
  const user = context.get(userContext);
  if (!user) throw new Response("Não autenticado.", { status: 401 });
  assertCanSeeFinancialModule(user);

  const formData = await request.formData();
  const raw: Record<string, string> = {};
  for (const [k, v] of formData) {
    if (typeof v === "string") raw[k] = v;
  }

  // Converte valor BRL para centavos
  const valorDisplay = raw.valorDisplay ?? "";
  const valorCentavos = parseBRLToCents(valorDisplay);

  // Monta payload para o schema
  const payload = {
    tipo: raw.tipo,
    categoria: raw.categoria,
    valorCentavos,
    caixaId: raw.caixaId,
    membroId: raw.membroId || null, // vazio → null
    dataCompetencia: raw.dataCompetencia,
    descricao: raw.descricao,
  };

  // Validação Zod
  const result = LancamentoCreateSchema.safeParse(payload);
  if (!result.success) {
    const fieldErrors = zodErrorsToMap(result.error.issues);
    // Se o valor não parseou, adiciona erro no campo display
    if (valorCentavos === null && !fieldErrors.valorCentavos) {
      fieldErrors.valorDisplay = "Valor inválido. Use o formato 1.234,56 ou 1234,56.";
    }
    return data({ fieldErrors, defaultValues: raw }, { status: 422 });
  }

  const validated = result.data;

  // Cria o lançamento via service layer (anti-TOCTOU + RBAC + auditoria + assertSaldoSuficiente)
  try {
    await criarLancamento(validated, user);
    return redirect(`/app/financeiro/caixas/${validated.caixaId}`);
  } catch (err: unknown) {
    // Response errors (403, 404, 409) — re-throw as-is (status codes já são apropriados)
    if (err instanceof Response) {
      throw err;
    }
    // ZodError (422) — mapeia para fieldErrors
    if (err instanceof ZodError) {
      const fieldErrors = zodErrorsToMap(err.issues);
      if (valorCentavos === null && !fieldErrors.valorCentavos) {
        fieldErrors.valorDisplay = "Valor inválido. Use o formato 1.234,56 ou 1234,56.";
      }
      return data({ fieldErrors, defaultValues: raw }, { status: 422 });
    }
    throw err;
  }
}

/**
 * Página de novo lançamento.
 */
export default function NovoLancamento({
  loaderData,
}: Route.ComponentProps) {
  const { caixas, membros, caixaIdPreSelected } = loaderData;
  const actionData = useActionData<typeof action>();

  // Extrai fieldErrors do actionData
  const fieldErrors: Record<string, string> =
    (actionData as { fieldErrors?: Record<string, string> } | undefined)
      ?.fieldErrors ?? {};
  const defaultValues: Record<string, string> =
    (actionData as { defaultValues?: Record<string, string> } | undefined)
      ?.defaultValues ?? {};

  // Se veio com caixaId da URL, pré-seleciona
  if (caixaIdPreSelected && !defaultValues.caixaId) {
    defaultValues.caixaId = caixaIdPreSelected;
  }

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">
        Novo Lançamento
      </h1>

      <FormLancamento
        caixas={caixas}
        membros={membros}
        fieldErrors={fieldErrors}
        defaultValues={defaultValues}
      />
    </div>
  );
}
