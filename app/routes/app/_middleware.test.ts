/**
 * Teste de app/routes/app/_middleware.tsx (S01-T05).
 *
 * Cobre: anônimo em /app/** → 302 /login?next=...; autenticado → injeta
 * `user` no context; sessão expirada → mesmo tratamento de anônimo.
 *
 * **Nota (refator S01 pós-build SSR):** o `authMiddleware` virou privado
 * (não é mais export nomeado) para evitar tree-shaking de imports
 * `*.server.ts` no client bundle. O teste agora consome o `middleware`
 * array (export público e reconhecido pelo RR7 como server-only) e o
 * primeiro item é o `authMiddleware`.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import {
  createContext,
  type MiddlewareFunction,
} from "react-router";
import type { RouterContextProvider } from "react-router";
import { prismaTest, setupTestDb } from "../../../tests/helpers/db";
import { hashPassword } from "~/lib/auth.server";
// userContext, authMiddleware, RouterContextProvider, createSession e sessionCookie
// são TODOS importados em beforeAll (depois de vi.resetModules) para garantir
// que sejam da MESMA versão de módulo — caso contrário, o `context.get` falha
// com "Cannot read properties of undefined (reading 'defaultValue')".

let cleanup: () => Promise<void>;
let authMiddleware: MiddlewareFunction;
let userContext: ReturnType<typeof createContext>;
let RouterContextProviderCtor: typeof import("react-router").RouterContextProvider;
let createSession: typeof import("~/lib/session.server").createSession;
let sessionCookie: typeof import("~/lib/session.server").sessionCookie;

beforeAll(async () => {
  cleanup = await setupTestDb("_middleware");
  vi.resetModules();
  // Importa DEPOIS do reset, do mesmo jeito, para garantir a MESMA versão
  // de módulo em todos os símbolos (RouterContextProvider, userContext, etc).
  const mod = await import("./_middleware");
  userContext = mod.userContext;
  authMiddleware = (mod.middleware as MiddlewareFunction[])[0];
  const rr = await import("react-router");
  RouterContextProviderCtor = rr.RouterContextProvider;
  const sess = await import("~/lib/session.server");
  createSession = sess.createSession;
  sessionCookie = sess.sessionCookie;
});

afterAll(async () => { await cleanup(); });
beforeEach(async () => {
  await prismaTest.session.deleteMany();
  await prismaTest.membro.deleteMany();
});

async function makeMembro(): Promise<{ id: string; nome: string; cargo: string }> {
  const m = await prismaTest.membro.create({
    data: {
      nome: "Auth Test",
      email: `auth-${Date.now()}-${Math.random()}@igreja.local`,
      tipo: "MEMBRO_ATIVO",
      cargo: "ADMIN",
      senhaHash: await hashPassword("senha-123"),
    },
  });
  return { id: m.id, nome: m.nome, cargo: m.cargo ?? "ADMIN" };
}

/**
 * Helper para criar um `DataFunctionArgs`-like mínimo. O RR7 espera
 * `url` e `pattern`, mas o middleware só usa `request` e `context`.
 */
function args(request: Request, context: RouterContextProvider) {
  const url = new URL(request.url);
  return {
    request,
    url,
    pattern: url.pathname,
    params: {},
    context,
  } as unknown as Parameters<MiddlewareFunction>[0];
}

describe("app/_middleware — authMiddleware (S01-T05)", () => {
  it("request sem cookie em /app/membros → throws redirect para /login?next=/app/membros", async () => {
    const context = new RouterContextProviderCtor();
    const request = new Request("http://localhost/app/membros", { method: "GET" });
    await expect(
      authMiddleware(
        args(request, context),
        async () => new Response()
      )
    ).rejects.toThrow();
  });

  it("anônimo: redirect vai para /login com ?next codificado (pathname + search)", async () => {
    const context = new RouterContextProviderCtor();
    const request = new Request("http://localhost/app/membros?tab=financeiro", { method: "GET" });
    try {
      await authMiddleware(
        args(request, context),
        async () => new Response()
      );
      expect.fail("deveria ter lançado");
    } catch (e) {
      expect(e).toBeInstanceOf(Response);
      const res = e as Response;
      expect(res.status).toBe(302);
      const location = res.headers.get("Location");
      expect(location).toBe("/login?next=%2Fapp%2Fmembros%3Ftab%3Dfinanceiro");
    }
  });

  it("com cookie válido: injeta user no context e chama next()", async () => {
    const membro = await makeMembro();
    const sid = await createSession(membro.id);
    const cookieHeader = await sessionCookie.serialize(sid);
    const request = new Request("http://localhost/app", {
      method: "GET",
      headers: { Cookie: cookieHeader },
    });
    const context = new RouterContextProviderCtor();
    const next = vi.fn(async () => new Response("ok", { status: 200 }));

    const res = await authMiddleware(
      args(request, context),
      next
    );
    expect(res).toBeInstanceOf(Response);
    expect(next).toHaveBeenCalledTimes(1);
    const user = context.get(userContext);
    expect(user).toEqual({
      id: membro.id,
      nome: membro.nome,
      cargo: membro.cargo,
    });
  });

  it("cookie inválido (sessão inexistente) → throws redirect (mesmo que anônimo)", async () => {
    const context = new RouterContextProviderCtor();
    const request = new Request("http://localhost/app", {
      method: "GET",
      headers: { Cookie: "__session=uuid-invalido-sem-assinatura" },
    });
    await expect(
      authMiddleware(
        args(request, context),
        async () => new Response()
      )
    ).rejects.toThrow();
  });

  it("sessão expirada (absoluteExpiresAt no passado) → throws redirect", async () => {
    const membro = await makeMembro();
    const sid = await createSession(membro.id);
    // Expira a sessão
    await prismaTest.session.update({
      where: { id: sid },
      data: { absoluteExpiresAt: new Date(Date.now() - 1000) },
    });
    const cookieHeader = await sessionCookie.serialize(sid);
    const request = new Request("http://localhost/app", {
      method: "GET",
      headers: { Cookie: cookieHeader },
    });
    const context = new RouterContextProviderCtor();
    try {
      await authMiddleware(
        args(request, context),
        async () => new Response()
      );
      expect.fail("deveria ter lançado");
    } catch (e) {
      expect(e).toBeInstanceOf(Response);
      expect((e as Response).status).toBe(302);
      expect((e as Response).headers.get("Location")).toBe("/login?next=%2Fapp");
    }
  });
});
