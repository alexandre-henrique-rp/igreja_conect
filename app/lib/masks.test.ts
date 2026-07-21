/**
 * Teste dos helpers de máscara client-side (S02-T05).
 *
 * Valida formatação progressiva de telefone e CEP enquanto o
 * usuário digita.
 */
import { describe, it, expect } from "vitest";
import { mascaraTelefone, mascaraCep } from "./masks";

describe("mascaraTelefone", () => {
  it("string vazia → vazia", () => {
    expect(mascaraTelefone("")).toBe("");
  });

  it("2 dígitos → (XX", () => {
    expect(mascaraTelefone("11")).toBe("(11");
  });

  it("6 dígitos → (XX) XXXX (fixo parcial)", () => {
    expect(mascaraTelefone("111234")).toBe("(11) 1234");
  });

  it("10 dígitos → (XX) XXXX-XXXX (fixo completo)", () => {
    expect(mascaraTelefone("1112345678")).toBe("(11) 1234-5678");
  });

  it("11 dígitos → (XX) 9 XXXX-XXXX (celular com espaço após o 9)", () => {
    expect(mascaraTelefone("11987654321")).toBe("(11) 9 8765-4321");
  });

  it("remove caracteres não-dígito (parênteses, hífens, espaços)", () => {
    expect(mascaraTelefone("(11) 9 8765-4321")).toBe("(11) 9 8765-4321");
  });

  it("limita a 11 dígitos (não concatena letras)", () => {
    expect(mascaraTelefone("119876543219999")).toBe("(11) 9 8765-4321");
  });

  it("auto-detecta fixo vs celular: 10 dígitos = fixo, 11 = celular", () => {
    expect(mascaraTelefone("1112345678")).toBe("(11) 1234-5678"); // fixo
    expect(mascaraTelefone("11123456789")).toBe("(11) 1 2345-6789"); // celular (mesmo com 1 no 3º dígito)
  });

  it("1 dígito → (X", () => {
    expect(mascaraTelefone("1")).toBe("(1");
  });
});

describe("mascaraCep", () => {
  it("string vazia → vazia", () => {
    expect(mascaraCep("")).toBe("");
  });

  it("5 dígitos → XXXXX", () => {
    expect(mascaraCep("01000")).toBe("01000");
  });

  it("8 dígitos → XXXXX-XXX", () => {
    expect(mascaraCep("01000000")).toBe("01000-000");
  });

  it("remove não-dígitos", () => {
    expect(mascaraCep("01000-000")).toBe("01000-000");
  });

  it("limita a 8 dígitos", () => {
    expect(mascaraCep("01000000999")).toBe("01000-000");
  });

  it("parcial: 3 dígitos → 3 chars sem hífen", () => {
    expect(mascaraCep("010")).toBe("010");
  });
});
