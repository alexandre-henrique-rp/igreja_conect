# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: financeiro-basico.spec.ts >> Financeiro básico — S06 >> Chain 1: FINANCEIRO registra DÍZIMO e vê +R$ 50,00 no extrato
- Location: e2e/financeiro-basico.spec.ts:101:3

# Error details

```
Error: page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:3000/app/financeiro
Call log:
  - navigating to "http://127.0.0.1:3000/app/financeiro", waiting until "load"

```

# Test source

```ts
  13  |  * Cada `test()` é 1 chain. O bloco `finally` registra response/result e
  14  |  * executa cleanup mesmo quando uma assertion falha. Resultados ficam em
  15  |  * `e2e/results/` para cumprir o path allowlist desta task.
  16  |  */
  17  | import {
  18  |   expect,
  19  |   test,
  20  |   type APIRequestContext,
  21  |   type Browser,
  22  |   type BrowserContext,
  23  |   type Page,
  24  | } from "@playwright/test";
  25  | import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
  26  | import { PrismaClient } from "../generated/prisma/client";
  27  | import { sessionCookie } from "../app/lib/session.server";
  28  | import { randomUUID } from "node:crypto";
  29  | import { promises as fs } from "node:fs";
  30  | import path from "node:path";
  31  | import { fileURLToPath } from "node:url";
  32  | 
  33  | const __filename = fileURLToPath(import.meta.url);
  34  | const __dirname = path.dirname(__filename);
  35  | const BASE_URL = process.env.BASE_URL ?? "http://127.0.0.1:3000";
  36  | const RESULTS_DIR = path.join(__dirname, "results");
  37  | const RESPONSES_DIR = path.join(RESULTS_DIR, "responses");
  38  | const prisma = new PrismaClient({
  39  |   adapter: new PrismaBetterSqlite3({ url: "file:./dev.db" }),
  40  | });
  41  | 
  42  | type LoginResult = {
  43  |   page: Page;
  44  |   context: BrowserContext;
  45  |   request: APIRequestContext;
  46  |   cookies: Awaited<ReturnType<BrowserContext["cookies"]>>;
  47  |   ip: string;
  48  | };
  49  | 
  50  | type ChainState = {
  51  |   failedAtStep?: number;
  52  |   failedReason?: string;
  53  |   cleanedUp?: boolean;
  54  |   cleanupError?: string;
  55  | };
  56  | 
  57  | const USERS = {
  58  |   admin: { email: "admin@igreja.local", cargo: "ADMIN" as const, nome: "Administrador" },
  59  |   financeiro: { email: "financeiro+e2e@igreja.local", cargo: "FINANCEIRO" as const, nome: "Financeiro E2E" },
  60  |   secretario: { email: "secretario+e2e@igreja.local", cargo: "SECRETARIO" as const, nome: "Secretario E2E" },
  61  |   discipulador: { email: "discipulador+e2e@igreja.local", cargo: "DISCIPULADOR" as const, nome: "Discipulador E2E" },
  62  | } as const;
  63  | 
  64  | test.beforeAll(async () => {
  65  |   const caixa = await prisma.caixa.upsert({
  66  |     where: { nome: "Caixa Geral" },
  67  |     update: { ativo: true, saldoCentavos: 0 },
  68  |     create: {
  69  |       nome: "Caixa Geral",
  70  |       ativo: true,
  71  |       saldoCentavos: 0,
  72  |     },
  73  |   });
  74  |   await prisma.lancamento.deleteMany({ where: { caixaId: caixa.id } });
  75  |   await prisma.membro.upsert({
  76  |     where: { email: USERS.discipulador.email },
  77  |     update: {},
  78  |     create: {
  79  |       email: USERS.discipulador.email,
  80  |       nome: USERS.discipulador.nome,
  81  |       cargo: USERS.discipulador.cargo,
  82  |       tipo: "MEMBRO_ATIVO",
  83  |     },
  84  |   });
  85  |   await prisma.membro.upsert({
  86  |     where: { email: "maria+e2e@igreja.local" },
  87  |     update: {},
  88  |     create: {
  89  |       email: "maria+e2e@igreja.local",
  90  |       nome: "Maria",
  91  |       tipo: "MEMBRO_ATIVO",
  92  |     },
  93  |   });
  94  | });
  95  | 
  96  | test.afterAll(async () => {
  97  |   await prisma.$disconnect();
  98  | });
  99  | 
  100 | test.describe.serial("Financeiro básico — S06", () => {
  101 |   test("Chain 1: FINANCEIRO registra DÍZIMO e vê +R$ 50,00 no extrato", async ({
  102 |     browser,
  103 |     playwright,
  104 |   }) => {
  105 |     const chainId = "E2E-FIN-CHAIN-1";
  106 |     const startedAt = Date.now();
  107 |     const state: ChainState = {};
  108 |     const login = await loginAs(browser, playwright, "financeiro", "10.6.1");
  109 |     let caixaId = "";
  110 |     let caixaArquivadoNoCleanup = false;
  111 | 
  112 |     try {
> 113 |       const response = await login.page.goto("/app/financeiro");
      |                                         ^ Error: page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:3000/app/financeiro
  114 |       await recordPage(chainId, 1, login.page, response, "dashboard");
  115 |       expect(response?.status(), "FINANCEIRO acessa dashboard").toBe(200);
  116 |       await expect(login.page.getByRole("heading", { name: "Financeiro" })).toBeVisible();
  117 |       await expect(login.page.getByTestId("card-saldo-caixa").filter({ hasText: "Caixa Geral" })).toContainText("R$ 0,00");
  118 |       caixaId = await caixaIdByName(login.page, "Caixa Geral");
  119 |       expect(caixaId, "Caixa Geral id extraído").toBeTruthy();
  120 | 
  121 |       await login.page.getByRole("link", { name: "+ Lançar" }).first().click();
  122 |       await expect(login.page).toHaveURL(/\/app\/financeiro\/lancamentos\/novo\?caixaId=/);
  123 |       await expect(login.page.getByLabel("Caixa")).toHaveValue(caixaId);
  124 | 
  125 |       await login.page.getByLabel("Tipo").selectOption("ENTRADA");
  126 |       await login.page.getByLabel("Categoria").selectOption("Dízimo");
  127 |       await login.page.getByLabel("Valor").fill("50,00");
  128 |       await login.page.getByLabel("Membro").selectOption({ label: "Maria" });
  129 |       await login.page.getByLabel("Data de Competência").fill(todayIsoDate());
  130 |       await login.page.getByLabel("Descrição").fill(`Dízimo E2E Chain 1 ${Date.now()}`);
  131 |       await login.page.getByRole("button", { name: "Criar Lançamento" }).click();
  132 |       await expect(login.page).toHaveURL(new RegExp(`/app/financeiro/caixas/${caixaId}$`));
  133 |       await expect(login.page.getByText("+ R$ 50,00")).toBeVisible();
  134 |       await expect(login.page.getByText("Dízimo")).toBeVisible();
  135 |       await recordPage(chainId, 2, login.page, null, "extrato-pos-dizimo");
  136 | 
  137 |       await dbSettle(100);
  138 |     } catch (error) {
  139 |       state.failedAtStep = 1;
  140 |       state.failedReason = error instanceof Error ? error.message : String(error);
  141 |       throw error;
  142 |     } finally {
  143 |       try {
  144 |         if (caixaId) {
  145 |           await createLancamentoViaRequest(login.request, login.cookies, {
  146 |             tipo: "SAIDA",
  147 |             categoria: "DESPESA_OPERACIONAL",
  148 |             valorDisplay: "50,00",
  149 |             caixaId,
  150 |             membroId: "",
  151 |             descricao: `Cleanup reverso Chain 1 ${Date.now()}`,
  152 |           });
  153 |           await dbSettle(100);
  154 |         }
  155 |         if (caixaArquivadoNoCleanup) {
  156 |           await reabrirCaixaViaUi(login.page, "Caixa Geral");
  157 |         }
  158 |         state.cleanedUp = true;
  159 |       } catch (cleanupError) {
  160 |         state.cleanupError = cleanupError instanceof Error ? cleanupError.message : String(cleanupError);
  161 |       }
  162 |       await recordResult(chainId, {
  163 |         id: chainId,
  164 |         status: state.failedReason ? "failed" : "passed",
  165 |         caixaId,
  166 |         durationMs: Date.now() - startedAt,
  167 |         ...state,
  168 |       });
  169 |       await disposeLogin(login);
  170 |     }
  171 |   });
  172 | 
  173 |   test("Chain 2: SECRETARIO vê financeiro sem DÍZIMOS", async ({
  174 |     browser,
  175 |     playwright,
  176 |   }) => {
  177 |     const chainId = "E2E-FIN-CHAIN-2";
  178 |     const startedAt = Date.now();
  179 |     const state: ChainState = {};
  180 |     const login = await loginAs(browser, playwright, "secretario", "10.6.2");
  181 | 
  182 |     try {
  183 |       const dashboard = await login.page.goto("/app/financeiro");
  184 |       await recordPage(chainId, 1, login.page, dashboard, "dashboard-secretario");
  185 |       expect(dashboard?.status(), "SECRETARIO acessa dashboard").toBe(200);
  186 |       const dashboardBody = await login.page.locator("body").innerText();
  187 |       expect(dashboardBody, "dashboard sem DÍZIMO para SECRETARIO").not.toContain("Dízimo");
  188 | 
  189 |       await login.page.getByRole("link", { name: "Caixas" }).click();
  190 |       await expect(login.page).toHaveURL(/\/app\/financeiro\/caixas$/);
  191 |       await expect(login.page.getByText("Caixas", { exact: true })).toBeVisible();
  192 | 
  193 |       const caixaId = await caixaIdByName(login.page, "Caixa Geral");
  194 |       await login.page.goto(`/app/financeiro/caixas/${caixaId}`);
  195 |       const extratoBody = await login.page.locator("body").innerText();
  196 |       await recordPage(chainId, 2, login.page, null, "extrato-secretario");
  197 |       expect(extratoBody, "extrato sem DÍZIMO para SECRETARIO").not.toContain("Dízimo");
  198 |     } catch (error) {
  199 |       state.failedAtStep = 1;
  200 |       state.failedReason = error instanceof Error ? error.message : String(error);
  201 |       throw error;
  202 |     } finally {
  203 |       try {
  204 |         state.cleanedUp = true;
  205 |       } catch (cleanupError) {
  206 |         state.cleanupError = cleanupError instanceof Error ? cleanupError.message : String(cleanupError);
  207 |       }
  208 |       await recordResult(chainId, {
  209 |         id: chainId,
  210 |         status: state.failedReason ? "failed" : "passed",
  211 |         durationMs: Date.now() - startedAt,
  212 |         ...state,
  213 |       });
```