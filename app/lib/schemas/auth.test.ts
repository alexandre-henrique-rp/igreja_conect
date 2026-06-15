/**
 * Teste de app/lib/schemas/auth.ts (S01-T02).
 *
 * Cobre LoginSchema: email válido, senha ≥ 1, manterConectado boolean
 * (coerção de string do form para boolean), mensagens em PT-BR.
 */
import { describe, it, expect } from "vitest";
import { LoginSchema } from "./auth";
import type { LoginFormInput } from "./auth";

describe("schemas/auth — LoginSchema (S01-T02)", () => {
  it("aceita email válido + senha preenchida + manterConectado boolean", () => {
    const result = LoginSchema.safeParse({
      email: "admin@igreja.local",
      senha: "qualquer-senha",
      manterConectado: true,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      const data: LoginFormInput = result.data;
      expect(data.email).toBe("admin@igreja.local");
      expect(data.senha).toBe("qualquer-senha");
      expect(data.manterConectado).toBe(true);
    }
  });

  it("aceita payload sem manterConectado (campo opcional)", () => {
    const result = LoginSchema.safeParse({
      email: "user@igreja.local",
      senha: "abc",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.manterConectado).toBeUndefined();
    }
  });

  it("coage string 'on' (checkbox de form) para boolean true", () => {
    const result = LoginSchema.safeParse({
      email: "user@igreja.local",
      senha: "abc",
      manterConectado: "on",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.manterConectado).toBe(true);
    }
  });

  it("rejeita email malformado com mensagem PT-BR", () => {
    const result = LoginSchema.safeParse({
      email: "nao-eh-email",
      senha: "qualquer",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const emailErr = result.error.issues.find((i) => i.path[0] === "email");
      expect(emailErr?.message).toBe("E-mail inválido. Verifique o formato.");
    }
  });

  it("rejeita senha vazia com mensagem PT-BR", () => {
    const result = LoginSchema.safeParse({
      email: "user@igreja.local",
      senha: "",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const senhaErr = result.error.issues.find((i) => i.path[0] === "senha");
      expect(senhaErr?.message).toBe("Senha obrigatória.");
    }
  });

  it("rejeita senha > 200 chars (anti-DoS)", () => {
    const result = LoginSchema.safeParse({
      email: "user@igreja.local",
      senha: "a".repeat(201),
    });
    expect(result.success).toBe(false);
  });

  it("rejeita payload sem campo email", () => {
    const result = LoginSchema.safeParse({ senha: "abc" });
    expect(result.success).toBe(false);
  });
});
