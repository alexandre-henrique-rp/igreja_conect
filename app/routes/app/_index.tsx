/**
 * Rota /app — Dashboard placeholder (S02-T10).
 *
 * **Estado S02:** placeholder que mostra saudação + card "Dashboard em
 * construção" com lista do que virá em S04. Serve como destino do
 * redirect pós-login.
 *
 * **S04 substituirá** este conteúdo por um dashboard com KPIs reais
 * (membros ativos, próximos cultos, dízimos do mês, etc).
 *
 * **AuthGate:** o `_middleware` de `/app/**` (em
 * `app/routes/app/_middleware.tsx`) garante que apenas usuários
 * autenticados cheguem aqui. Este loader ainda valida (defense in depth)
 * e lança 401 se o user sumir do context.
 */
import type { Route } from "./+types/_index";
import { userContext } from "~/lib/user-context";
import { CardInfo } from "~/components/CardInfo";

export function meta(_args: Route.MetaArgs) {
  return [{ title: "Igreja Conect" }];
}

/**
 * Loader: lê o user injetado pelo middleware de auth.
 *
 * @description Valida presença do user no context (defense in depth) e
 *   retorna para o componente. Em teoria o middleware já garante
 *   user !== null; a checagem cobre o caso de a rota ser acessada
 *   sem o middleware no futuro.
 */
export async function loader({ context }: Route.LoaderArgs) {
  const user = context.get(userContext);
  if (!user) {
    throw new Response("Não autenticado.", { status: 401 });
  }
  return { user };
}

/**
 * Componente padrão da rota: saudação + card de placeholder.
 */
export default function AppIndex({ loaderData }: Route.ComponentProps) {
  return (
    <main id="main-content" className="p-4 sm:p-6 max-w-6xl mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">
          Olá, {loaderData.user.nome}.
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          Você está autenticado como{" "}
          <span className="font-medium text-slate-700">
            {loaderData.user.cargo ?? "membro"}
          </span>
          .
        </p>
      </header>

      <CardInfo
        title="Dashboard em construção"
        tone="planned"
        description="Os indicadores (membros ativos, próximos cultos, dízimos do mês) virão na Sprint S04. Por enquanto, use o menu lateral para acessar as áreas disponíveis."
        items={[
          "Membros (cadastrar, listar, editar, excluir)",
          "Ministérios (sprints futuras)",
          "Alertas (sprints futuras)",
          "Configurações (apenas ADMIN — sprints futuras)",
        ]}
      />
    </main>
  );
}
