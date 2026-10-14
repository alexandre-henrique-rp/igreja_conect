/**
 * Captura visual das rotas-chave após refactor.
 *
 * Usa o Chromium do Playwright para tirar screenshots e salvar em
 * `e2e/screenshots/` para validar que a UX mudou visualmente.
 */
import { test, expect } from "@playwright/test";
import path from "node:path";

const ADMIN_EMAIL = "kingdevtec@gmail.com";
const ADMIN_PASSWORD = "senha123";

test.beforeEach(async ({ context }) => {
  await context.setExtraHTTPHeaders({
    "x-forwarded-for": `10.77.${Math.floor(Math.random() * 254)}.${Math.floor(Math.random() * 254)}`,
  });
});

const SHOTS = path.join(import.meta.dirname, "screenshots");

async function login(page: any) {
  await page.goto("/");
  await page.getByRole("link", { name: /entrar/i }).first().click();
  await expect(page).toHaveURL(/\/login$/);
  await page.getByRole("textbox", { name: /e-?mail/i }).fill(ADMIN_EMAIL);
  await page.getByRole("textbox", { name: /senha/i }).fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: /^entrar$/i }).click();
  await expect(page).toHaveURL(/\/app$/, { timeout: 15_000 });
}

test.describe("Visual capture — DS primitives", () => {
  test("landing renderiza com tokens semânticos", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /gestão completa/i })).toBeVisible();
    await page.screenshot({ path: path.join(SHOTS, "01-landing.png"), fullPage: true });
  });

  test("login renderiza com split + church illustration", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: /cuide da casa/i })).toBeVisible();
    await page.screenshot({ path: path.join(SHOTS, "02-login.png"), fullPage: true });
  });

  test("dashboard com KpiCards + PageHeader + Section", async ({ page }) => {
    await login(page);
    await expect(page.locator("main h1, main h2").first()).toBeVisible({ timeout: 10_000 });
    await page.screenshot({ path: path.join(SHOTS, "03-dashboard.png"), fullPage: true });
  });

  test("membros com KpiCards + PageHeader + Card + EmptyState/tabela", async ({ page }) => {
    await login(page);
    await page.getByRole("link", { name: /^membros$/i }).first().click();
    await expect(page).toHaveURL(/\/app\/membros$/);
    await expect(page.locator("main h1, main h2").first()).toBeVisible({ timeout: 10_000 });
    await page.screenshot({ path: path.join(SHOTS, "04-membros.png"), fullPage: true });

    // Captura também em dark mode para validar zebra striping
    await page.getByRole("button", { name: /tema/i }).first().click();
    await page.waitForTimeout(150);
    await page.getByRole("button", { name: /tema/i }).first().click();
    await page.waitForTimeout(400);
    await page.screenshot({
      path: path.join(SHOTS, "04b-membros-dark.png"),
      fullPage: true,
    });

    // Captura também /app/celulas em dark mode para validar a página de células
    await page.goto("/app/celulas");
    await expect(page).toHaveURL(/\/app\/celulas$/);
    await page.waitForTimeout(300);
    await page.screenshot({
      path: path.join(SHOTS, "08-celulas-dark.png"),
      fullPage: true,
    });
  });

  test("financeiro com PageHeader + Card + KpiCard + IconWrap", async ({ page }) => {
    await login(page);
    await page.goto("/app/financeiro");
    await expect(page).toHaveURL(/\/app\/financeiro$/);
    await expect(page.locator("main h1").first()).toBeVisible({ timeout: 10_000 });
    await page.screenshot({ path: path.join(SHOTS, "05-financeiro.png"), fullPage: true });

    // Captura também em dark mode para validar o card Resumo Anual
    await page.getByRole("button", { name: /tema/i }).first().click();
    await page.waitForTimeout(150);
    await page.getByRole("button", { name: /tema/i }).first().click();
    await page.waitForTimeout(400);
    await page.screenshot({
      path: path.join(SHOTS, "05b-financeiro-dark.png"),
      fullPage: true,
    });
  });

  test("membros/novo com FormMembro", async ({ page }) => {
    await login(page);
    await page.getByRole("link", { name: /^membros$/i }).first().click();
    await page.getByRole("link", { name: /novo membro/i }).first().click();
    await expect(page).toHaveURL(/\/app\/membros\/novo$/);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(SHOTS, "07-membros-novo.png"), fullPage: true });
  });

test("dark mode via toggle (auto → light → dark)", async ({ page }) => {
    await login(page);
    const themeBtn = page.getByRole("button", { name: /tema/i }).first();

    await themeBtn.click();
    await page.waitForTimeout(200);
    await themeBtn.click();
    await page.waitForTimeout(400);

    const themeAttr = await page.evaluate(() =>
      document.documentElement.getAttribute("data-theme"),
    );
    expect(themeAttr).toBe("dark");

    await page.screenshot({ path: path.join(SHOTS, "06-dashboard-dark.png"), fullPage: true });
  });
});