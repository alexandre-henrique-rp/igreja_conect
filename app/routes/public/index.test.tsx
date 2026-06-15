/**
 * Teste da landing `app/routes/public/index.tsx` (S01-T08).
 *
 * Cobre dois cenários:
 * 1. Loader: anônimo → null; autenticado → redirect 302 para /app.
 * 2. Componente: renderiza <h1>Igreja Conect</h1> + botão Entrar → /login.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { createRoutesStub } from "react-router";
import { renderToString } from "react-dom/server";
import { prismaTest, setupTestDb } from "../../../tests/helpers/db";
import { hashPassword } from "~/lib/auth.server";

let cleanup: () => Promise<void>;
let loader: typeof import("./index").loader;

beforeAll(async () => {
  cleanup = await setupTestDb("index");
  await prismaTest.membro.create({
    data: {
      nome: "Admin Landing",
      email: "admin-landing@igreja.local",
      tipo: "MEMBRO_ATIVO",
      cargo: "ADMIN",
      senhaHash: await hashPassword("senha-123"),
    },
  });
  vi.resetModules();
  // Importa ./index PRIMEIRO (que transitivamente traz session.server
  // com a URL de teste). Importar ~/lib/session.server diretamente
  // antes pode fazer com que o singleton Prisma seja inicializado com
  // a URL errada (dev.db em vez de test.db).
  const mod = await import("./index");
  loader = mod.loader;
});

afterAll(async () => {
  await cleanup();
});

beforeEach(async () => {
  await prismaTest.session.deleteMany();
});

describe("Landing — loader", () => {
  it("anônimo (sem cookie) → null (renderiza a página)", async () => {
    const res = await loader({
      request: new Request("http://localhost/"),
    } as Parameters<typeof loader>[0]);
    expect(res).toBeNull();
  });

  it("autenticado (cookie válido) → throw redirect para /app", async () => {
    // Importa session server DEPOIS do import do index (que já
    // inicializou o singleton com a URL correta).
    const { createSession, sessionCookie } = await import(
      "~/lib/session.server"
    );
    const m = await prismaTest.membro.findFirstOrThrow({
      where: { email: "admin-landing@igreja.local" },
    });
    const sid = await createSession(m.id);
    const cookieHeader = await sessionCookie.serialize(sid);

    // `throw redirect(...)` em RR7 vira Response. Capturamos via try/catch
    // (em algumas versões o RR7 propaga como throw) ou via duck typing
    // (checamos `status` direto).
    let result: Response | unknown;
    let caught: unknown;
    try {
      result = await loader({
        request: new Request("http://localhost/", {
          headers: { Cookie: cookieHeader },
        }),
      } as Parameters<typeof loader>[0]);
    } catch (e) {
      caught = e;
    }

    // Caminho 1: o throw redirect do RR7 → response direto
    const response =
      result instanceof Response
        ? result
        : caught instanceof Response
          ? caught
          : null;

    expect(response).not.toBeNull();
    expect(response!.status).toBe(302);
    expect(response!.headers.get("Location")).toBe("/app");
  });
});

describe("Landing — render", () => {
  it("renderiza <h1>Igreja Conect</h1> e botão Entrar com href /login", async () => {
    // Re-importa módulo fresco (após beforeAll) e usa o default export
    const mod = await import("./index");
    const Stub = createRoutesStub([
      {
        path: "/",
        Component: () => mod.default(),
      },
    ]);
    const html = renderToString(<Stub initialEntries={["/"]} />);
    expect(html).toContain("<h1");
    expect(html).toContain("Igreja Conect");
    // Botão Entrar (pode estar na TopbarPublica OU no CTA — ambos)
    expect(html).toContain('href="/login"');
    expect(html).toContain("Entrar");
    // main com id para skip link
    expect(html).toContain('id="main-content"');
  });
});
