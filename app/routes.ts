import {
  type RouteConfig,
  index,
  layout,
  route,
} from "@react-router/dev/routes";

/**
 * Configuração declarativa de rotas do Igreja Conect (atualizado S02).
 *
 * **Hierarquia de `/app/**`:**
 * ```
 * routes/app/_middleware.tsx   (camada de auth: lê cookie, injeta user)
 *   └─ routes/app.tsx           (shell visual: Topbar + Sidebar + Outlet)
 *        ├─ routes/app/_index.tsx           (Dashboard placeholder)
 *        ├─ routes/app/membros._index.tsx   (Lista com filtros + paginação)
 *        └─ routes/app/membros.$id.tsx      (Detalhe — primeira versão)
 * ```
 *
 * **Por que dois layouts aninhados:**
 * - `_middleware.tsx` aplica o middleware de auth (RR7 v8_middleware) e
 *   renderiza `<Outlet />` para o filho.
 * - `app.tsx` é o shell visual (TopbarAutenticada + Sidebar + Outlet).
 *   Separar a **lógica de auth** do **layout visual** deixa cada um
 *   testável e substituível (ex: testes de layout não rodam middleware).
 *
 * **Rotas em S02 — escopo do frontend agent:**
 * - Lista de membros + detalhe.
 * - Placeholder dashboard.
 * - Layout autenticado.
 *
 * Rotas marcadas como "backend" (criar/editar) virão em S02-T06 e
 * S02-T08 (outras tasks, outros agents).
 */
export default [
  // Pagina institucional
  index("routes/public/index.tsx"),

  // Public
  route("/login", "routes/public/login.tsx"),
  route("/logout", "routes/logout.tsx"),

  // /app/** — autenticado. O middleware de auth vive em
  // `routes/app/_middleware.tsx` e é aplicado a TODAS as rotas filhas.
  layout("routes/app/_middleware.tsx", [
    // Layout visual (Topbar + Sidebar + Outlet) envolve todas as
    // páginas autenticadas em /app/**.
    route("app", "routes/app.tsx", [
      // Dashboard placeholder (S02-T10)
      index("routes/app/_index.tsx"),

      // Lista de membros com filtros + paginação (S02-T04)
      route("membros", "routes/app/membros._index.tsx"),

      // Detalhe do membro — primeira versão, sem abas (S02-T07)
      route("membros/:id", "routes/app/membros.$id.tsx"),

      // S02-T06: criar novo membro (action chama createMembro)
      route("membros/novo", "routes/app/membros.novo.tsx"),
      // S02-T08: editar membro (loader+action)
      route("membros/:id/editar", "routes/app/membros.$id.editar.tsx"),

      // S06 — Módulo Financeiro
      route("financeiro", "routes/app/financeiro._index.tsx"),
      route("financeiro/caixas", "routes/app/financeiro.caixas._index.tsx"),
      route("financeiro/caixas/novo", "routes/app/financeiro.caixas.novo.tsx"),
      route("financeiro/caixas/:id", "routes/app/financeiro.caixas.$id.tsx"),
      route(
        "financeiro/lancamentos/novo",
        "routes/app/financeiro.lancamentos.novo.tsx",
      ),
      route(
        "financeiro/transferencias/nova",
        "routes/app/financeiro.transferencia-nova.tsx",
      ),

      // S15 (cycle 4) — Relatórios Financeiros (5 páginas, dados mock)
      // Reais services em app/lib/relatorios.server.ts serão integrados quando S14 backend for implementado
      route(
        "financeiro/relatorios",
        "routes/app/financeiro.relatorios._index.tsx",
      ),
      route(
        "financeiro/relatorios/dre",
        "routes/app/financeiro.relatorios.dre.tsx",
      ),
      route(
        "financeiro/relatorios/balancete",
        "routes/app/financeiro.relatorios.balancete.tsx",
      ),
      route(
        "financeiro/relatorios/fluxo-caixa",
        "routes/app/financeiro.relatorios.fluxo-caixa.tsx",
      ),
      route(
        "financeiro/relatorios/customizado",
        "routes/app/financeiro.relatorios.customizado.tsx",
      ),

      // Ministérios
      route("ministerios", "routes/app/ministerios._index.tsx"),
      route("ministerios/novo", "routes/app/ministerios.novo.tsx"),
      route("ministerios/:id", "routes/app/ministerios.$id.tsx"),

      // Escalas
      route("escalas", "routes/app/escalas._index.tsx"),
      route("escalas/novo", "routes/app/escalas.novo.tsx"), // Formulário de Nova Escala

      // Cultos
      route("cultos", "routes/app/cultos._index.tsx"),
      route("cultos/novo", "routes/app/cultos.novo.tsx"),
      route("cultos/:id/editar", "routes/app/cultos.$id.editar.tsx"),

      // Estoque
      route("estoque", "routes/app/estoque._index.tsx", [
        route("novo", "routes/app/estoque.novo.tsx"),
        route(":id", "routes/app/estoque.$id._index.tsx"),
        route(":id/_transicao", "routes/app/estoque.$id._transicao.tsx"),
        route(":id/movimentar", "routes/app/estoque.$id.movimentar.tsx"),
        route(":id/manutencao", "routes/app/estoque.$id.manutencao.tsx"),
        route(":id/retorno", "routes/app/estoque.$id.retorno.tsx"),
        route(":id/baixa", "routes/app/estoque.$id.baixa.tsx"),
      ]),

      // Patrimônio (atalho UX, redireciona para /app/estoque?tipo=PATRIMONIO)
      route("patrimonio", "routes/app/patrimonio.tsx"),

      // Configurações
      route("config/acolhimento", "routes/app/config.acolhimento.tsx"),

      // Células
      route("celulas", "routes/app/celulas._index.tsx"),

      // Eventos
      route("eventos", "routes/app/eventos._index.tsx"),

      // Alertas
      route("alertas", "routes/app/alertas._index.tsx"),
    ]),
  ]),
] satisfies RouteConfig;
