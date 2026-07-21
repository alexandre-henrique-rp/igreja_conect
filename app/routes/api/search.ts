import type { Route } from "./+types/search";
import { data } from "react-router";
import { getUserFromRequest } from "~/lib/session.server";
import { prisma } from "~/db/prisma.server";

export async function loader({ request }: Route.LoaderArgs) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return data({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const type = url.searchParams.get("type") ?? "";
  const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();

  if (type === "celulas") {
    const celulas = await prisma.celula.findMany({
      where: q ? { nome: { contains: q } } : undefined,
      select: { id: true, nome: true, diaSemana: true, horario: true },
      take: 10,
      orderBy: { nome: "asc" },
    });
    return data({
      results: celulas.map((c) => ({
        id: c.id,
        label: c.nome,
        sublabel: [c.diaSemana, c.horario].filter(Boolean).join(" · ") || undefined,
      })),
    });
  }

  if (type === "members") {
    const members = await prisma.membro.findMany({
      where: q ? { nome: { contains: q } } : undefined,
      select: { id: true, nome: true, tipo: true },
      take: 10,
      orderBy: { nome: "asc" },
    });
    return data({
      results: members.map((m) => ({
        id: m.id,
        label: m.nome,
        sublabel: m.tipo === "MEMBRO_ATIVO" ? "Membro" : m.tipo === "VISITANTE" ? "Visitante" : "Congregado",
      })),
    });
  }

  return data({ error: "invalid_type" }, { status: 400 });
}
