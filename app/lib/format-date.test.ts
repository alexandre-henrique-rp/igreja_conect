/**
 * Teste do helper `formatRelative` (S04-T07 / S04-T10).
 *
 * Função pura e testável que retorna texto relativo em PT-BR.
 * Aceita `now` como parâmetro opcional para evitar Date.now() no render.
 */
import { describe, it, expect } from "vitest";
import { formatRelative } from "./format-date";

describe("formatRelative", () => {
  const now = new Date("2026-06-13T14:00:00.000Z");

  it('retorna "agora" para diferença de 0 segundos', () => {
    expect(formatRelative(new Date("2026-06-13T14:00:00.000Z"), now)).toBe(
      "agora"
    );
  });

  it('retorna "agora" para menos de 1 minuto', () => {
    expect(formatRelative(new Date("2026-06-13T13:59:45.000Z"), now)).toBe(
      "agora"
    );
  });

  it('retorna "há 1 minuto" para 1 minuto atrás', () => {
    expect(formatRelative(new Date("2026-06-13T13:59:00.000Z"), now)).toBe(
      "há 1 minuto"
    );
  });

  it('retorna "há 5 minutos" para 5 minutos atrás', () => {
    expect(formatRelative(new Date("2026-06-13T13:55:00.000Z"), now)).toBe(
      "há 5 minutos"
    );
  });

  it('retorna "há 1 hora" para 1 hora atrás', () => {
    expect(formatRelative(new Date("2026-06-13T13:00:00.000Z"), now)).toBe(
      "há 1 hora"
    );
  });

  it('retorna "há 2 horas" para 2 horas atrás', () => {
    expect(formatRelative(new Date("2026-06-13T12:00:00.000Z"), now)).toBe(
      "há 2 horas"
    );
  });

  it('retorna "ontem" para 1 dia atrás (mesmo horário)', () => {
    expect(formatRelative(new Date("2026-06-12T14:00:00.000Z"), now)).toBe(
      "ontem"
    );
  });

  it('retorna "há 3 dias" para 3 dias atrás', () => {
    expect(formatRelative(new Date("2026-06-10T14:00:00.000Z"), now)).toBe(
      "há 3 dias"
    );
  });

  it('retorna "há 7 dias" para 1 semana atrás', () => {
    expect(formatRelative(new Date("2026-06-06T14:00:00.000Z"), now)).toBe(
      "há 7 dias"
    );
  });

  it('retorna "há 30 dias" para ~1 mês atrás', () => {
    expect(formatRelative(new Date("2026-05-14T14:00:00.000Z"), now)).toBe(
      "há 30 dias"
    );
  });

  it('retorna data formatada para mais de 30 dias', () => {
    const result = formatRelative(new Date("2025-01-01T00:00:00.000Z"), now);
    // Deve retornar algo como "01/01/2025"
    expect(result).toMatch(/\d{2}\/\d{2}\/\d{4}/);
  });

  it("funciona sem parâmetro now (usa Date.now internamente)", () => {
    const result = formatRelative(new Date());
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it('retorna "há 1 minuto" para 60 segundos exatos atrás', () => {
    const date = new Date(now.getTime() - 60_000);
    expect(formatRelative(date, now)).toBe("há 1 minuto");
  });
});
