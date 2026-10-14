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
import { useState } from "react";
import { ZodError } from "zod";
import type { Route } from "./+types/financeiro.lancamentos.novo";
import { userContext } from "~/lib/user-context";
import { assertCanSeeFinancialModule } from "~/lib/rbac.server";
import { parseBRLToCents } from "~/lib/money-format";
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

  // Estado da categoria controla visibilidade do select de membro.
  // Só DÍZIMO exige membro (RN-FIN-05); demais categorias não mostram o campo.
  const [categoria, setCategoria] = useState<string>(defaultValues.categoria ?? "");
  const exibirMembro = categoria === "DIZIMO";

  // Estado do tipo controla visibilidade da seção "Status e Observações".
  // ENTRADA é sempre confirmada (PAGO) automaticamente; SAÍDA exige escolha do usuário.
  const [tipo, setTipo] = useState<string>(tipoDefault);
  const isSaida = tipo === "SAIDA";

  // Categorias disponíveis conforme o tipo selecionado.
  // ENTRADA → DÍZIMO/OFERTA/CAMPANHA; SAÍDA → DESPESA_OPERACIONAL/COMPRA_ESTOQUE/MANUTENCAO.
  const categoriasDoTipo = isSaida ? CATEGORIAS_SAIDA : CATEGORIAS_ENTRADA;

  // Se a categoria atual não pertence ao tipo selecionado, reseta para placeholder.
  const categoriaEhValidaParaTipo = categoriasDoTipo.includes(categoria as never);
  const categoriaValue = categoriaEhValidaParaTipo ? categoria : "";

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-fg">Novo Lançamento</h1>
          <p className="text-muted mt-1">Registre uma nova transação financeira.</p>
        </div>
        <Button as={Link} to="/app/financeiro" variant="secondary" size="sm">
          Cancelar
        </Button>
      </div>

      <form method="POST" noValidate className="space-y-6">
        {/* Tipo: Entrada / Saída */}
        <div className="bg-surface rounded-xl border border-border p-1 flex">
          <label className="flex-1 cursor-pointer">
            <input
              type="radio"
              name="tipo"
              value="ENTRADA"
              checked={tipo === "ENTRADA"}
              onChange={() => setTipo("ENTRADA")}
              className="sr-only peer"
            />
            <span className="flex items-center justify-center gap-2 h-11 rounded-lg text-sm font-semibold text-muted peer-checked:bg-success-soft peer-checked:text-success peer-checked:border peer-checked:border-success-soft transition-colors">
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
              checked={tipo === "SAIDA"}
              onChange={() => setTipo("SAIDA")}
              className="sr-only peer"
            />
            <span className="flex items-center justify-center gap-2 h-11 rounded-lg text-sm font-semibold text-muted peer-checked:bg-danger-soft peer-checked:text-danger peer-checked:border peer-checked:border-danger-soft transition-colors">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14M5 12l7 7 7-7" />
              </svg>
              SAÍDA
            </span>
          </label>
        </div>
        {fieldErrors.tipo && <p role="alert" className="text-sm text-danger">{fieldErrors.tipo}</p>}

        {/* ENTRADA é sempre confirmada (PAGO) automaticamente — não exige escolha do usuário. */}
        {!isSaida && <input type="hidden" name="status" value="PAGO" />}

        {/* Informações Básicas */}
        <div className="bg-surface rounded-xl border border-border overflow-hidden">
          <div className="px-6 py-4 border-b border-border flex items-center gap-2">
            <svg className="h-5 w-5 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 16v-4M12 8h.01" />
            </svg>
            <h2 className="font-semibold text-fg">Informações Básicas</h2>
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
                defaultValue={defaultValues.dataCompetencia ?? new Date().toISOString().slice(0, 10)}
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

            {/* Membro vinculado — só aparece para DÍZIMO (RN-FIN-05: obrigatório).
                Demais categorias (OFERTA, CAMPANHA, DESPESA_*, etc.) não vinculam membro. */}
            {exibirMembro && (
              <Select
                name="membroId"
                label="Membro vinculado (obrigatório para Dízimo)"
                placeholder="Selecione o membro"
                options={membros.map((m) => ({ value: m.id, label: m.nome }))}
                defaultValue={defaultValues.membroId ?? ""}
              />
            )}
            {exibirMembro && fieldErrors.membroId && <p role="alert" className="text-sm text-danger">{fieldErrors.membroId}</p>}
          </div>
        </div>

        {/* Status e Observações — só aparece para SAÍDA.
            ENTRADA é sempre confirmada (PAGO) automaticamente via hidden input acima. */}
        {isSaida && (
          <div className="bg-surface rounded-xl border border-border overflow-hidden">
            <div className="px-6 py-4 border-b border-border flex items-center gap-2">
              <svg className="h-5 w-5 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              <h2 className="font-semibold text-fg">Status e Observações</h2>
            </div>
            <div className="p-6 space-y-5">
              <fieldset>
                <legend className="text-sm font-medium text-fg">Situação do Lançamento</legend>
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
                      <span className="text-sm text-fg">{STATUS_LABEL[s]}</span>
                    </label>
                  ))}
                </div>
                {fieldErrors.status && <p role="alert" className="text-sm text-danger mt-1">{fieldErrors.status}</p>}
              </fieldset>

              <Input
                name="beneficiario"
                label="Beneficiário / Destino (opcional)"
                placeholder="Ex: Novo som, Empresa XYZ, Igreja sede..."
                defaultValue={defaultValues.beneficiario ?? ""}
                error={fieldErrors.beneficiario}
              />

              <div className="space-y-1">
                <label htmlFor="descricao" className="block text-sm font-medium text-fg">
                  Observações (Opcional)
                </label>
                <textarea
                  id="descricao"
                  name="descricao"
                  rows={4}
                  defaultValue={defaultValues.descricao ?? ""}
                  placeholder="Informações adicionais sobre o lançamento..."
                  className="w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-fg placeholder:text-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
                />
                {fieldErrors.descricao && <p role="alert" className="text-sm text-danger">{fieldErrors.descricao}</p>}
              </div>
            </div>
          </div>
        )}

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
