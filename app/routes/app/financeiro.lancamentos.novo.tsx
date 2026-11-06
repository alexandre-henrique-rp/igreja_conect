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
import { data, Link, redirect, useActionData, useNavigation } from "react-router";
import { useState } from "react";
import { ZodError } from "zod";
import type { Route } from "./+types/financeiro.lancamentos.novo";
import { userContext } from "~/lib/user-context";
import { assertCanSeeFinancialModule } from "~/lib/rbac.server";
import { formatBRLFromCents, parseBRLToCents } from "~/lib/money-format";
import { CATEGORIAS_LANCAMENTO, LancamentoCreateSchema, STATUS_LANCAMENTO } from "~/lib/schemas/lancamentos";
import { criarLancamento } from "~/lib/lancamentos.server";
import { listarCaixasParaSelect } from "~/lib/caixas.server";
import { listarMembrosParaSelect } from "~/lib/members.server";
import { Button, Input, Select } from "~/components/ds";
import { MoneyInput } from "~/components/MoneyInput";

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
    beneficiario: raw.beneficiario || undefined,
  };

  // Validação Zod
  const result = LancamentoCreateSchema.safeParse(payload);
  if (!result.success) {
    const fieldErrors = zodErrorsToMap(result.error.issues);
    // Se o valor não parseou, adiciona erro no campo display
    if (valorCentavos === null && !fieldErrors.valorCentavos) {
      fieldErrors.valorDisplay = "Valor inválido. Use o formato 1.234,56 ou 1234,56.";
    }
    return data({ formError: null, fieldErrors, defaultValues: raw }, { status: 422 });
  }

  const validated = result.data;

  // Cria o lançamento via service layer (anti-TOCTOU + RBAC + auditoria + assertSaldoSuficiente)
  try {
    await criarLancamento(validated, user);
    return redirect("/app/financeiro?sucesso=lancamento_criado");
  } catch (err: unknown) {
    // Response errors (400, 403, 404, 409 etc) — retorna fallback explicativo sem quebrar a UI
    if (err instanceof Response) {
      let errorMessage = "Erro ao processar o lançamento.";
      try {
        const text = await err.text();
        if (text) errorMessage = text;
      } catch {
        // mantém mensagem de fallback
      }
      return data(
        { formError: errorMessage, fieldErrors: {}, defaultValues: raw },
        { status: err.status }
      );
    }
    // ZodError (422) — mapeia para fieldErrors
    if (err instanceof ZodError) {
      const fieldErrors = zodErrorsToMap(err.issues);
      if (valorCentavos === null && !fieldErrors.valorCentavos) {
        fieldErrors.valorDisplay = "Valor inválido. Use o formato 1.234,56 ou 1234,56.";
      }
      return data({ formError: null, fieldErrors, defaultValues: raw }, { status: 422 });
    }
    const message = err instanceof Error ? err.message : "Erro inesperado ao salvar lançamento.";
    return data(
      { formError: message, fieldErrors: {}, defaultValues: raw },
      { status: 500 }
    );
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

/** Categorias de ENTRADA (contribuições). */
const CATEGORIAS_ENTRADA = ["DIZIMO", "OFERTA", "CAMPANHA"] as const;

/** Categorias de SAÍDA (despesas). TRANSFERENCIA é exclusiva do sistema de transferências. */
const CATEGORIAS_SAIDA = ["DESPESA_OPERACIONAL", "COMPRA_ESTOQUE", "MANUTENCAO"] as const;

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
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  // Extrai formError e fieldErrors do actionData
  const formError: string | null =
    (actionData as { formError?: string | null } | undefined)?.formError ?? null;
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
  const statusDefault = defaultValues.status ?? "PAGO";

  // Estado do tipo controla categorias disponíveis e seções visíveis
  const [tipo, setTipo] = useState<string>(tipoDefault);
  const isSaida = tipo === "SAIDA";

  // Estado da categoria controla visibilidade do select de membro
  const [categoria, setCategoria] = useState<string>(defaultValues.categoria ?? "");
  const exibirMembro = categoria === "DIZIMO";

  // Troca de tipo reseta categoria se ela não for válida para o novo tipo
  const handleTipoChange = (novoTipo: string) => {
    setTipo(novoTipo);
    setCategoria("");
  };

  // Categorias disponíveis conforme o tipo selecionado.
  // ENTRADA → DÍZIMO/OFERTA/CAMPANHA; SAÍDA → DESPESA_OPERACIONAL/COMPRA_ESTOQUE/MANUTENCAO.
  const categoriasDoTipo = isSaida ? CATEGORIAS_SAIDA : CATEGORIAS_ENTRADA;
  const categoriaEhValidaParaTipo = categoriasDoTipo.includes(categoria as never);
  const categoriaValue = categoriaEhValidaParaTipo ? categoria : "";

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-fg">Novo Lançamento</h1>
          <p className="text-muted mt-1 text-sm">Registre uma nova transação financeira no caixa da igreja.</p>
        </div>
        <Button as={Link} to="/app/financeiro" variant="secondary" size="sm">
          Cancelar
        </Button>
      </div>

      {/* Fallback de erro da ação */}
      {formError && (
        <div
          role="alert"
          aria-live="assertive"
          className="mb-6 rounded-xl border border-danger-soft bg-danger-soft/20 p-4 text-danger flex items-start gap-3 shadow-sm"
        >
          <svg
            className="h-5 w-5 shrink-0 mt-0.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <div className="flex-1 text-sm">
            <p className="font-semibold text-danger">Não foi possível salvar o lançamento</p>
            <p className="mt-1 text-fg">{formError}</p>
          </div>
        </div>
      )}

      <form method="POST" noValidate className="space-y-6">
        {/* Tipo: Entrada / Saída com alta usabilidade e contraste */}
        <div className="bg-surface rounded-xl border border-border p-1.5 flex gap-1 shadow-xs">
          <label className="flex-1 cursor-pointer">
            <input
              type="radio"
              name="tipo"
              value="ENTRADA"
              checked={tipo === "ENTRADA"}
              onChange={() => handleTipoChange("ENTRADA")}
              className="sr-only"
            />
            <span
              className={`flex items-center justify-center gap-2 h-11 rounded-lg text-sm font-semibold transition-all ${
                tipo === "ENTRADA"
                  ? "bg-success-soft text-success shadow-xs font-bold border border-success-soft"
                  : "text-muted hover:text-fg hover:bg-surface-2"
              }`}
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 19V5M5 12l7-7 7 7" />
              </svg>
              ENTRADA (Receitas / Doações)
            </span>
          </label>
          <label className="flex-1 cursor-pointer">
            <input
              type="radio"
              name="tipo"
              value="SAIDA"
              checked={tipo === "SAIDA"}
              onChange={() => handleTipoChange("SAIDA")}
              className="sr-only"
            />
            <span
              className={`flex items-center justify-center gap-2 h-11 rounded-lg text-sm font-semibold transition-all ${
                tipo === "SAIDA"
                  ? "bg-danger-soft text-danger shadow-xs font-bold border border-danger-soft"
                  : "text-muted hover:text-fg hover:bg-surface-2"
              }`}
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 5v14M5 12l7 7 7-7" />
              </svg>
              SAÍDA (Despesas / Pagamentos)
            </span>
          </label>
        </div>
        {fieldErrors.tipo && <p role="alert" className="text-sm text-danger">{fieldErrors.tipo}</p>}

        {/* ENTRADA é sempre confirmada (PAGO) automaticamente */}
        {!isSaida && <input type="hidden" name="status" value="PAGO" />}

        {/* Informações Básicas */}
        <div className="bg-surface rounded-xl border border-border overflow-hidden">
          <div className="px-6 py-4 border-b border-border flex items-center gap-2">
            <svg className="h-5 w-5 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 16v-4M12 8h.01" />
            </svg>
            <h2 className="font-semibold text-fg">Informações do Lançamento</h2>
          </div>
          <div className="p-6 space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <MoneyInput
                name="valorDisplay"
                label="Valor (R$)"
                defaultValue={defaultValues.valorDisplay ?? ""}
                error={fieldErrors.valorDisplay}
                required
              />
              <Input
                name="dataCompetencia"
                label="Data de Competência"
                type="date"
                defaultValue={defaultValues.dataCompetencia ?? new Date().toISOString().slice(0, 10)}
                error={fieldErrors.dataCompetencia}
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Select
                name="caixaId"
                label="Caixa / Conta"
                placeholder="Selecione o caixa de destino/origem"
                options={caixas.map((c) => ({
                  value: c.id,
                  label: `${c.nome} (Saldo: ${formatBRLFromCents(c.saldoCentavos)})`,
                }))}
                defaultValue={defaultValues.caixaId ?? ""}
              />
              <Select
                name="categoria"
                label="Categoria"
                placeholder="Selecione a categoria"
                options={categoriasDoTipo.map((c) => ({
                  value: c,
                  label: CATEGORIA_LABEL[c] ?? c,
                }))}
                value={categoriaValue}
                onChange={(e) => setCategoria(e.target.value)}
              />
            </div>
            {fieldErrors.caixaId && <p role="alert" className="text-sm text-danger">{fieldErrors.caixaId}</p>}
            {fieldErrors.categoria && <p role="alert" className="text-sm text-danger">{fieldErrors.categoria}</p>}

            {/* Membro vinculado — só aparece para DÍZIMO (RN-FIN-05: obrigatório) */}
            {exibirMembro && (
              <Select
                name="membroId"
                label="Membro vinculado (obrigatório para Dízimo)"
                placeholder="Selecione o membro dizimista"
                options={membros.map((m) => ({ value: m.id, label: m.nome }))}
                defaultValue={defaultValues.membroId ?? ""}
              />
            )}
            {exibirMembro && fieldErrors.membroId && <p role="alert" className="text-sm text-danger">{fieldErrors.membroId}</p>}

            {/* Descrição disponível para TODOS os lançamentos (ENTRADA e SAÍDA) */}
            <div className="space-y-1">
              <label htmlFor="descricao" className="block text-sm font-medium text-fg">
                Descrição / Identificação (Opcional)
              </label>
              <textarea
                id="descricao"
                name="descricao"
                rows={2}
                defaultValue={defaultValues.descricao ?? ""}
                placeholder={isSaida ? "Ex: Pagamento da conta de energia elétrica, Compra de materiais..." : "Ex: Oferta de gratidão do culto matutino, Campanha missionária..."}
                className="w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-fg placeholder:text-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
              />
              {fieldErrors.descricao && <p role="alert" className="text-sm text-danger">{fieldErrors.descricao}</p>}
            </div>
          </div>
        </div>

        {/* Detalhes de SAÍDA: Beneficiário e Situação */}
        {isSaida && (
          <div className="bg-surface rounded-xl border border-border overflow-hidden">
            <div className="px-6 py-4 border-b border-border flex items-center gap-2">
              <svg className="h-5 w-5 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              <h2 className="font-semibold text-fg">Situação do Pagamento</h2>
            </div>
            <div className="p-6 space-y-5">
              <fieldset>
                <legend className="text-sm font-medium text-fg">Status da Saída</legend>
                <div className="flex flex-wrap gap-4 mt-2">
                  {STATUS_LANCAMENTO.map((s) => (
                    <label key={s} className="inline-flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="status"
                        value={s}
                        defaultChecked={statusDefault === s}
                        className="h-4 w-4 text-accent border-border-strong focus:ring-accent"
                      />
                      <span className="text-sm text-fg font-medium">{STATUS_LABEL[s]}</span>
                    </label>
                  ))}
                </div>
                {fieldErrors.status && <p role="alert" className="text-sm text-danger mt-1">{fieldErrors.status}</p>}
              </fieldset>

              <Input
                name="beneficiario"
                label="Favorecido / Fornecedor / Destino (opcional)"
                placeholder="Ex: Companhia de Energia, Fornecedor X, Empresa ABC..."
                defaultValue={defaultValues.beneficiario ?? ""}
                error={fieldErrors.beneficiario}
              />
            </div>
          </div>
        )}

        {/* Ações com feedback de submissão */}
        <div className="flex items-center gap-3">
          <Button type="submit" className="flex-1" disabled={isSubmitting}>
            {isSubmitting ? "Salvando lançamento..." : "Salvar Lançamento"}
          </Button>
          <Button as={Link} to="/app/financeiro" variant="secondary" disabled={isSubmitting}>
            Cancelar
          </Button>
        </div>
      </form>
    </div>
  );
}

/**
 * ErrorBoundary da rota — fallback ideal se ocorrer qualquer erro inesperado.
 */
export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Ocorreu um erro inesperado ao processar o lançamento.";
  if (error instanceof Error) {
    message = error.message;
  }
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="rounded-xl border border-danger-soft bg-danger-soft/10 p-6 space-y-4">
        <div className="flex items-center gap-3 text-danger">
          <svg className="h-6 w-6 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <h1 className="text-xl font-bold">Erro no Lançamento</h1>
        </div>
        <p className="text-sm text-fg">{message}</p>
        <div className="flex items-center gap-3 pt-2">
          <Button as={Link} to="/app/financeiro/lancamentos/novo" variant="secondary" size="sm">
            Tentar novamente
          </Button>
          <Button as={Link} to="/app/financeiro" variant="secondary" size="sm">
            Voltar ao módulo financeiro
          </Button>
        </div>
      </div>
    </div>
  );
}
