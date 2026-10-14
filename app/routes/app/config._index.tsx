/**
 * Rota /app/config — hub de Configurações.
 *
 * O Design System (`configuracoes.html`) prevê um painel de configurações
 * com abas (Conta, Igreja, Notificações, Segurança, Aparência). Hoje a
 * única aba com serviço de backend implementado é **Acolhimento**
 * (`getConfigAcolhimento`/`updateConfigAcolhimento`, RN-MEM-05, ADMIN-only).
 *
 * Enquanto as demais abas aguardam serviços de backing (ver
 * `docs/UX-MIGRATION-PLAN.md` §2 — gaps "aguardando mockup/serviço"),
 * `/app/config` redireciona para a aba funcional, mantendo o item
 * "Configurações" da sidebar sempre resolvível (sem 404).
 */
import { redirect } from "react-router";

export function loader() {
  return redirect("/app/config/acolhimento");
}
