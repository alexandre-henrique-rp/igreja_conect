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
import { data, Link, redirect, useActionData } from "react-router";
import { ZodError } from "zod";
import type { Route } from "./+types/financeiro.lancamentos.novo";
import { userContext } from "~/lib/user-context";
import { assertCanSeeFinancialModule } from "~/lib/rbac.server";
import { parseBRLToCents } from "~/lib/money-format";
import { CATEGORIAS_LANCAMENTO, LancamentoCreateSchema, STATUS_LANCAMENTO } from "~/lib/schemas/lancamentos";
import { criarLancamento } from "~/lib/lancamentos.server";
import { listarCaixasParaSelect } from "~/lib/caixas.server";
import { listarMembrosParaSelect } from "~/lib/members.server";
import { Button } from "~/components/Button";
import { Input } from "~/components/Input";
import { MoneyInput } from "~/components/MoneyInput";
import { Select } from "~/components/Select";

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
    status: raw.status,
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
/** Labels amigáveis para categoria. */
const CATEGORIA_LABEL: Record<string, string> = {
  DIZIMO: "Dízimos",
  OFERTA: "Ofertas",
  CAMPANHA: "Campanhas",
  DESPESA_OPERACIONAL: "Despesa Operacional",
  COMPRA_ESTOQUE: "Compra de Estoque",
  MANUTENCAO: "Manutenção",
  TRANSFERENCIA: "Transferência",
};

/** Labels amigáveis para situação. */
const STATUS_LABEL: Record<string, string> = {
  PAGO: "Pago / Confirmado",
  PENDENTE: "Pendente",
  AGENDADO: "Agendado",
};

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

  const tipoDefault = defaultValues.tipo ?? "ENTRADA";
  const statusDefault = defaultValues.status ?? "PENDENTE";

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Novo Lançamento</h1>
          <p className="text-slate-600 mt-1">Registre uma nova transação financeira.</p>
        </div>
        <Button as={Link} to="/app/financeiro" variant="secondary" size="sm">
          Cancelar
        </Button>
      </div>

      <form method="POST" noValidate className="space-y-6">
        {/* Tipo: Entrada / Saída */}
        <div className="bg-white rounded-xl border border-slate-200 p-1 flex">
          <label className="flex-1 cursor-pointer">
            <input
              type="radio"
              name="tipo"
              value="ENTRADA"
              defaultChecked={tipoDefault !== "SAIDA"}
              className="sr-only peer"
            />
            <span className="flex items-center justify-center gap-2 h-11 rounded-lg text-sm font-semibold text-slate-600 peer-checked:bg-emerald-50 peer-checked:text-emerald-700 peer-checked:border peer-checked:border-emerald-200 transition-colors">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 19V5M5 12l7-7 7 7" />
              </svg>
              ENTRADA
            </span>
          </label>
          <label className="flex-1 cursor-pointer">
            <input
              type="radio"
              name="tipo"
              value="SAIDA"
              defaultChecked={tipoDefault === "SAIDA"}
              className="sr-only peer"
            />
            <span className="flex items-center justify-center gap-2 h-11 rounded-lg text-sm font-semibold text-slate-600 peer-checked:bg-red-50 peer-checked:text-red-700 peer-checked:border peer-checked:border-red-200 transition-colors">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14M5 12l7 7 7-7" />
              </svg>
              SAÍDA
            </span>
          </label>
        </div>
        {fieldErrors.tipo && <p role="alert" className="text-sm text-red-700">{fieldErrors.tipo}</p>}

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
            <MoneyInput
              name="valorDisplay"
              label="Valor (R$)"
              defaultValue={defaultValues.valorDisplay ?? ""}
              error={fieldErrors.valorDisplay}
              required
            />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input
                name="dataCompetencia"
                label="Data de Competência"
                type="date"
                defaultValue={defaultValues.dataCompetencia ?? ""}
                error={fieldErrors.dataCompetencia}
                required
              />
              <Select
                name="caixaId"
                label="Conta Bancária"
                placeholder="Selecione"
                options={caixas.map((c) => ({ value: c.id, label: c.nome }))}
                defaultValue={defaultValues.caixaId ?? ""}
              />
              <Select
                name="categoria"
                label="Categoria"
                placeholder="Selecione"
                options={CATEGORIAS_LANCAMENTO.map((c) => ({
                  value: c,
                  label: CATEGORIA_LABEL[c] ?? c,
                }))}
                defaultValue={defaultValues.categoria ?? ""}
              />
            </div>
            {fieldErrors.caixaId && <p role="alert" className="text-sm text-red-700">{fieldErrors.caixaId}</p>}
            {fieldErrors.categoria && <p role="alert" className="text-sm text-red-700">{fieldErrors.categoria}</p>}
          </div>
        </div>

        {/* Status e Observações */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center gap-2">
            <svg className="h-5 w-5 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            <h2 className="font-semibold text-slate-900">Status e Observações</h2>
          </div>
          <div className="p-6 space-y-5">
            <fieldset>
              <legend className="text-sm font-medium text-slate-700">Situação do Lançamento</legend>
              <div className="flex flex-wrap gap-4 mt-2">
                {STATUS_LANCAMENTO.map((s) => (
                  <label key={s} className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="status"
                      value={s}
                      defaultChecked={statusDefault === s}
                      className="h-4 w-4 text-cyan-700 border-slate-300 focus:ring-cyan-700"
                    />
                    <span className="text-sm text-slate-700">{STATUS_LABEL[s]}</span>
                  </label>
                ))}
              </div>
              {fieldErrors.status && <p role="alert" className="text-sm text-red-700 mt-1">{fieldErrors.status}</p>}
            </fieldset>

            <div className="space-y-1">
              <label htmlFor="descricao" className="block text-sm font-medium text-slate-700">
                Observações (Opcional)
              </label>
              <textarea
                id="descricao"
                name="descricao"
                rows={4}
                defaultValue={defaultValues.descricao ?? ""}
                placeholder="Informações adicionais sobre o lançamento..."
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-700 focus-visible:ring-offset-2"
              />
              {fieldErrors.descricao && <p role="alert" className="text-sm text-red-700">{fieldErrors.descricao}</p>}
            </div>
          </div>
        </div>

        {/* Ações */}
        <div className="flex items-center gap-3">
          <Button type="submit" className="flex-1">
            Salvar Lançamento
          </Button>
          <Button as={Link} to="/app/financeiro" variant="secondary">
            Cancelar
          </Button>
        </div>
      </form>
    </div>
  );
}
