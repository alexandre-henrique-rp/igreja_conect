/**
 * Teste do componente <RelativeTime /> (S04-T07).
 *
 * Renderiza <time dateTime={ISO}> com texto formatado PT-BR relativo.
 * Usa formatRelative internamente, passando now como parâmetro.
 */
import { describe, it, expect } from "vitest";
import { createRoutesStub } from "react-router";
import { renderToString } from "react-dom/server";
import { RelativeTime } from "./RelativeTime";

function renderTime(props: {
  date: Date;
  now?: Date;
}): string {
  const Stub = createRoutesStub([
    {
      path: "/",
      Component: () => (
        <RelativeTime date={props.date} now={props.now} />
      ),
    },
  ]);
  return renderToString(<Stub initialEntries={["/"]} />);
}

describe("<RelativeTime />", () => {
  const now = new Date("2026-06-13T14:00:00.000Z");

  it("renderiza <time> com datetime ISO (atributo HTML)", () => {
    const date = new Date("2026-06-13T12:00:00.000Z");
    const html = renderTime({ date, now });
    expect(html).toContain("<time");
    // React SSR preserva 'dateTime' (camelCase) no HTML do <time>
    expect(html).toContain('dateTime="2026-06-13T12:00:00.000Z"');
  });

  it('exibe "há 5 minutos" para 5 minutos atrás', () => {
    const date = new Date("2026-06-13T13:55:00.000Z");
    const html = renderTime({ date, now });
    expect(html).toContain("há 5 minutos");
  });

  it('exibe "ontem" para 1 dia atrás', () => {
    const date = new Date("2026-06-12T14:00:00.000Z");
    const html = renderTime({ date, now });
    expect(html).toContain("ontem");
  });

  it("exibe data DD/MM/AAAA para mais de 30 dias", () => {
    // Usar horário local para evitar timezone offset no getDate()
    const date = new Date(2025, 0, 1, 12, 0, 0); // 01/01/2025 meio-dia local
    const html = renderTime({ date, now });
    expect(html).toContain("01/01/2025");
  });

  it("tem data-testid='relative-time'", () => {
    const date = new Date(now.getTime() - 5 * 60_000);
    const html = renderTime({ date, now });
    expect(html).toContain('data-testid="relative-time"');
  });

  it("aceita className customizada", () => {
    const date = new Date(now.getTime() - 5 * 60_000);
    const Stub = createRoutesStub([
      {
        path: "/",
        Component: () => (
          <RelativeTime date={date} now={now} className="text-xs" />
        ),
      },
    ]);
    const html = renderToString(<Stub initialEntries={["/"]} />);
    expect(html).toContain("text-xs");
  });
});
