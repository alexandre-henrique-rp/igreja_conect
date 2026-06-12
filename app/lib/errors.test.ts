/**
 * Teste de app/lib/errors.ts (S00-T10).
 */
import { describe, it, expect } from "vitest";
import {
  BusinessRuleError,
  ForbiddenError,
  NotFoundError,
  EmailDuplicadoError,
  NomeDuplicadoError,
} from "./errors";

describe("lib/errors", () => {
  it("BusinessRuleError instancia com message e statusCode", () => {
    const e = new BusinessRuleError("Limite de 12 discípulos");
    expect(e.message).toBe("Limite de 12 discípulos");
    expect(e.statusCode).toBe(422);
    expect(e).toBeInstanceOf(Error);
  });

  it("ForbiddenError tem statusCode 403", () => {
    const e = new ForbiddenError("Acesso negado");
    expect(e.message).toBe("Acesso negado");
    expect(e.statusCode).toBe(403);
  });

  it("NotFoundError tem statusCode 404", () => {
    const e = new NotFoundError("Membro não encontrado");
    expect(e.message).toBe("Membro não encontrado");
    expect(e.statusCode).toBe(404);
  });

  it("EmailDuplicadoError tem statusCode 409", () => {
    const e = new EmailDuplicadoError("Email já existe");
    expect(e.message).toBe("Email já existe");
    expect(e.statusCode).toBe(409);
  });

  it("NomeDuplicadoError tem statusCode 409", () => {
    const e = new NomeDuplicadoError("Nome já existe");
    expect(e.message).toBe("Nome já existe");
    expect(e.statusCode).toBe(409);
  });
});
