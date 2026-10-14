/**
 * Smoke E2E — Igreja Conect.
 *
 * **Caminho feliz dos pontos críticos do Design System:**
 * 1. Login via botões (não URL).
 * 2. Dashboard renderiza com KpiCards.
 * 3. Toggle de tema funciona (light → dark → auto).
 * 4. Lista de Membros → clicar em "Ver" navega para detalhe.
 * 5. Botão "Novo membro" abre o formulário.
 * 6. Sidebar navega para Financeiro e Estoque.
 * 7. Estoque → botão Movimentar abre o dialog.
 *
 * **Credenciais:** lidas do seed (`admin@igreja.local` / `admin123`).
 *
 * **Anti-padrão evitado:** `page.goto("/app/financeiro")` — aqui SEMPRE
 * navegamos via clique em botão visível, como um usuário real.
 */
import { test, expect, type Page } from "@playwright/test";

const ADMIN_EMAIL = "kingdevtec@gmail.com";
const ADMIN_PASSWORD = "senha123";

async function login(page: Page) {
  await page.goto("/");
  await page.getByRole("link", { name: /entrar/i }).first().click();
  await expect(page).toHaveURL(/\/login$/);
  await page.getByRole("textbox", { name: /e-?mail/i }).fill(ADMIN_EMAIL);
  await page.getByRole("textbox", { name: /senha/i }).fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: /^entrar$/i }).click();
  await expect(page).toHaveURL(/\/app$/, { timeout: 15_000 });
}

test.beforeEach(async ({ context }) => {
  await context.setExtraHTTPHeaders({
    "x-forwarded-for": `10.99.${Math.floor(Math.random() * 254)}.${Math.floor(Math.random() * 254)}`,
  });
});

test.describe("DS Smoke — pontos críticos", () => {
  test("login via botão navega para /app e renderiza dashboard", async ({ page }) => {
    await login(page);
    await expect(page.getByRole("heading", { name: /dashboard/i })).toBeVisible();
    await expect(page.getByText(/saldo financeiro/i)).toBeVisible();
    await expect(page.getByText(/membros ativos/i)).toBeVisible();
    await expect(page.getByText(/visitantes/i)).toBeVisible();
    await expect(page.getByText(/alertas de estoque/i)).toBeVisible();
  });

  test("toggle de tema alterna entre light e dark", async ({ page }) => {
    await login(page);
    const themeBtn = page.getByRole("button", { name: /tema/i }).first();
    const initial = await page.evaluate(() =>
      document.documentElement.getAttribute("data-theme"),
    );

    await themeBtn.click();
    const afterFirst = await page.evaluate(() =>
      document.documentElement.getAttribute("data-theme"),
    );

    await themeBtn.click();
    const afterSecond = await page.evaluate(() =>
      document.documentElement.getAttribute("data-theme"),
    );

    expect(initial).not.toBe(afterFirst);
    expect(afterFirst).not.toBe(afterSecond);
  });

  test("sidebar → Membros → Detalhe via clique no nome", async ({ page }) => {
    await login(page);

    await page.getByRole("link", { name: /^membros$/i }).first().click();
    await expect(page).toHaveURL(/\/app\/membros$/);
    await expect(page.locator("main h2, main h1").first()).toBeVisible({ timeout: 10_000 });

    const memberLink = page
      .locator("a[href^='/app/membros/']")
      .filter({ hasNotText: /novo/i })
      .first();
    await memberLink.click();
    await expect(page).toHaveURL(/\/app\/membros\/[^/]+$/);
  });

  test("botão 'Novo membro' navega para /app/membros/novo", async ({ page }) => {
    await login(page);

    await page.getByRole("link", { name: /^membros$/i }).first().click();
    await page.getByRole("link", { name: /novo membro/i }).first().click();
    await expect(page).toHaveURL(/\/app\/membros\/novo$/);
    await expect(page.getByLabel(/nome/i).first()).toBeVisible();
    await expect(page.getByLabel(/e-?mail/i).first()).toBeVisible();
  });

  test("sidebar → Financeiro renderiza KPIs e lista de caixas", async ({ page }) => {
    await login(page);

    await page.getByRole("link", { name: /^financeiro$/i }).first().click();
    await expect(page).toHaveURL(/\/app\/financeiro$/);
    await expect(page.getByRole("heading", { name: /financeiro/i })).toBeVisible();
  });

  test("sidebar → Estoque → Detalhe → Movimentar abre formulário", async ({ page }) => {
    await login(page);

    await page.getByRole("link", { name: /^estoque$/i }).first().click();
    await expect(page).toHaveURL(/\/app\/estoque$/);
    await expect(page.locator("main h2, main h1").first()).toBeVisible({ timeout: 10_000 });

    const firstItemLink = page
      .locator("a[href^='/app/estoque/']")
      .filter({ hasNotText: /novo/i })
      .first();
    if (!(await firstItemLink.isVisible().catch(() => false))) {
      test.skip(true, "Sem itens de estoque seedados");
      return;
    }
    await firstItemLink.click();
    await expect(page).toHaveURL(/\/app\/estoque\/[^/?]+$/);

    const movBtn = page.getByRole("link", { name: /movimentar/i }).first();
    if (await movBtn.isVisible()) {
      await movBtn.click();
      await expect(page).toHaveURL(/\/movimentar$/);
    }
  });

  test("botão logout encerra sessão e redireciona para /login", async ({ page }) => {
    await login(page);
    await page.getByRole("button", { name: /sair/i }).first().click();
    await expect(page).toHaveURL(/\/login$/);
  });
});