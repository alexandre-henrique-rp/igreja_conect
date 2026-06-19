/**
 * Helpers E2E para o módulo financeiro (S07-T05).
 *
 * Funções auxiliares para testes end-to-end de:
 * - Login como diferentes perfis
 * - Criação de caixas e lançamentos
 * - Navegação para transferência
 *
 * @example
 *   await loginAs(page, "ADMIN");
 *   await irParaTransferencia(page);
 */
import type { Page } from "@playwright/test";

/**
 * Tipos de perfil de usuário para login E2E.
 */
export type PerfilFinanceiro = "ADMIN" | "PASTOR" | "FINANCEIRO" | "SECRETARIO";

/**
 * Realiza login como o perfil especificado.
 *
 * Assume que a página de login está em /login ou que existe
 * um usuário de teste para cada perfil no banco de dados de teste.
 *
 * @param page - Página do Playwright.
 * @param perfil - Perfil para login (ADMIN, PASTOR, FINANCEIRO, SECRETARIO).
 * @returns Promise<void>
 * @example
 *   await loginAs(page, "ADMIN");
 */
export async function loginAs(page: Page, perfil: PerfilFinanceiro): Promise<void> {
  // Credenciais de teste por perfil (configurável via env)
  const credenciais: Record<PerfilFinanceiro, { email: string; senha: string }> = {
    ADMIN: {
      email: process.env.E2E_ADMIN_EMAIL ?? "admin@igreja.test",
      senha: process.env.E2E_ADMIN_SENHA ?? "Admin@123",
    },
    PASTOR: {
      email: process.env.E2E_PASTOR_EMAIL ?? "pastor@igreja.test",
      senha: process.env.E2E_PASTOR_SENHA ?? "Pastor@123",
    },
    FINANCEIRO: {
      email: process.env.E2E_FINANCEIRO_EMAIL ?? "financeiro@igreja.test",
      senha: process.env.E2E_FINANCEIRO_SENHA ?? "Financeiro@123",
    },
    SECRETARIO: {
      email: process.env.E2E_SECRETARIO_EMAIL ?? "secretario@igreja.test",
      senha: process.env.E2E_SECRETARIO_SENHA ?? "Secretario@123",
    },
  };

  const cred = credenciais[perfil];

  // Navega para login se necessário
  if (!page.url().includes("/login")) {
    await page.goto("/login");
  }

  // Preenche formulário
  await page.getByLabel(/e-mail/i).fill(cred.email);
  await page.getByLabel(/senha/i).fill(cred.senha);
  await page.getByRole("button", { name: /entrar/i }).click();

  // Aguarda redirect para área autenticada
  await page.waitForURL(/\/app\//, { timeout: 10000 });
}

/**
 * Cria um novo caixa via UI.
 *
 * Usa o formulário em /app/financeiro/caixas/novo.
 *
 * @param page - Página do Playwright.
 * @param nome - Nome do caixa.
 * @param saldoInicial - Saldo inicial em centavos (default 0).
 * @returns Promise<string> ID do caixa criado (do redirect).
 * @example
 *   const id = await criarCaixa(page, "Cantina", 5000);
 */
export async function criarCaixa(
  page: Page,
  nome: string,
  saldoInicial = 0
): Promise<string> {
  await page.goto("/app/financeiro/caixas/novo");
  await page.getByLabel(/nome/i).fill(nome);
  await page.getByRole("button", { name: /criar/i }).click();

  // Extrai ID do redirect
  await page.waitForURL(/caixa=/);
  const url = page.url();
  const idMatch = url.match(/caixa=([^&]+)/);
  return idMatch?.[1] ?? "";
}

/**
 * Cria um lançamento financeiro via UI.
 *
 * Usa o formulário em /app/financeiro/lancamentos/novo.
 *
 * @param page - Página do Playwright.
 * @param caixaId - UUID do caixa para o lançamento.
 * @param tipo - Tipo: ENTRADA ou SAIDA.
 * @param valor - Valor em centavos.
 * @param descricao - Descrição do lançamento.
 * @returns Promise<void>
 * @example
 *   await criarLancamento(page, caixaId, "ENTRADA", 10000, "Dízimo");
 */
export async function criarLancamento(
  page: Page,
  caixaId: string,
  tipo: "ENTRADA" | "SAIDA",
  valor: number,
  descricao: string
): Promise<void> {
  await page.goto("/app/financeiro/lancamentos/novo");
  await page.getByLabel(/tipo/i).selectOption(tipo);
  await page.getByLabel(/caixa/i).selectOption(caixaId);
  // Valor em reais para o MoneyInput
  await page.getByLabel(/valor/i).fill((valor / 100).toFixed(2).replace(".", ","));
  await page.getByLabel(/descrição/i).fill(descricao);
  await page.getByRole("button", { name: /criar/i }).click();
  await page.waitForURL(/\/app\/financeiro/);
}

/**
 * Navega para a página de nova transferência.
 *
 * @param page - Página do Playwright.
 * @returns Promise<void>
 * @example
 *   await irParaTransferencia(page);
 *   await expect(page.getByTestId("form-transferencia")).toBeVisible();
 */
export async function irParaTransferencia(page: Page): Promise<void> {
  await page.goto("/app/financeiro/transferencias/nova");
}
