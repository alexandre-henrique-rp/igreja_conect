/**
 * Teste do componente <CardAlerta /> (S04-T07).
 *
 * Card de alerta com:
 * - Borda esquerda cyan-600 se não lido
 * - opacity 75% se resolvido
 * - Título + mensagem + RelativeTime
 * - Form method="post" com _action="marcarLido" ou "marcarResolvido"
 * - Link "Ver membro" se alerta.membroId presente
 */
import { describe, it, expect } from "vitest";
import { createRoutesStub } from "react-router";
import { renderToString } from "react-dom/server";
import { CardAlerta, type CardAlertaProps } from "./CardAlerta";

function renderCard(props: CardAlertaProps): string {
  const Stub = createRoutesStub([
    {
      path: "/",
      Component: () => <CardAlerta {...props} />,
    },
    {
      path: "/app/membros/:id",
      Component: () => null,
    },
  ]);
  return renderToString(<Stub initialEntries={["/"]} />);
}

const now = new Date("2026-06-13T14:00:00.000Z");

const baseAlerta = {
  id: "a1",
  titulo: "Novo visitante",
  mensagem: "João Silva visitou a igreja hoje",
  createdAt: new Date("2026-06-13T13:00:00.000Z"),
  lido: false,
  resolvido: false,
};

const baseUser = {
  nome: "Admin",
  cargo: "ADMIN" as const,
};

describe("<CardAlerta />", () => {
  it("renderiza título e mensagem", () => {
    const html = renderCard({
      alerta: baseAlerta,
      user: baseUser,
      now,
    });
    expect(html).toContain("Novo visitante");
    expect(html).toContain("João Silva visitou a igreja hoje");
  });

  it("renderiza RelativeTime com a data de criação", () => {
    const html = renderCard({
      alerta: baseAlerta,
      user: baseUser,
      now,
    });
    expect(html).toContain("data-testid=\"relative-time\"");
  });

  it("quando não lido: tem borda esquerda cyan-600", () => {
    const html = renderCard({
      alerta: baseAlerta,
      user: baseUser,
      now,
    });
    expect(html).toContain("border-l-cyan-600");
  });

  it("quando lido (lido=true): NÃO tem borda cyan", () => {
    const html = renderCard({
      alerta: { ...baseAlerta, lido: true },
      user: baseUser,
      now,
    });
    expect(html).not.toContain("border-l-cyan-600");
  });

  it("quando resolvido: opacity 75% (opacity-75)", () => {
    const html = renderCard({
      alerta: { ...baseAlerta, resolvido: true },
      user: baseUser,
      now,
    });
    expect(html).toContain("opacity-75");
  });

  it("quando não lido: renderiza form com _action='marcarLido'", () => {
    const html = renderCard({
      alerta: baseAlerta,
      user: baseUser,
      now,
    });
    expect(html).toContain('name="_action"');
    expect(html).toContain('value="marcarLido"');
    expect(html).toContain("Marcar lido");
  });

  it("quando lido mas não resolvido: renderiza form com _action='marcarResolvido'", () => {
    const html = renderCard({
      alerta: { ...baseAlerta, lido: true },
      user: baseUser,
      now,
      canResolve: true,
    });
    expect(html).toContain('value="marcarResolvido"');
    expect(html).toContain("Resolver");
  });

  it("quando tem membroId: renderiza Link 'Ver membro'", () => {
    const html = renderCard({
      alerta: { ...baseAlerta, membroId: "m1" },
      user: baseUser,
      now,
    });
    expect(html).toContain("Ver membro");
    expect(html).toContain('href="/app/membros/m1"');
  });

  it("quando NÃO tem membroId: não renderiza Link 'Ver membro'", () => {
    const html = renderCard({
      alerta: baseAlerta,
      user: baseUser,
      now,
    });
    expect(html).not.toContain("Ver membro");
  });

  it("quando resolvido: não renderiza form de ação", () => {
    const html = renderCard({
      alerta: { ...baseAlerta, resolvido: true },
      user: baseUser,
      now,
    });
    expect(html).not.toContain('name="_action"');
  });

  it("data-testid no container", () => {
    const html = renderCard({
      alerta: baseAlerta,
      user: baseUser,
      now,
    });
    expect(html).toContain('data-testid="card-alerta"');
  });
});
