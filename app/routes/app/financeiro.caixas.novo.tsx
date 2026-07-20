/**
 * Rota /app/financeiro/caixas/novo — Criar Novo Caixa (S06-T11).
 *
 * **Loader:** `assertCanManageCaixa(user)` — Camada 2 RBAC.
 *
 * **Action:** valida com `CaixaCreateSchema.safeParse`, chama `criarCaixa`.
 *   409 (nome duplicado) → formError. 422 (Zod) → fieldError.
 *
 * @see app/lib/schemas/caixas.ts (CaixaCreateSchema)
 * @see app/lib/caixas.server.ts (criarCaixa)
 */
import {
  data,
  Link,
  redirect,
  useActionData,
  useNavigation,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "react-router";
import type { Route } from "./+types/financeiro.caixas.novo";
import { userContext } from "~/lib/user-context";
import { assertCanManageCaixa } from "~/lib/rbac.server";
import { criarCaixa } from "~/lib/caixas.server";
import { CaixaCreateSchema } from "~/lib/schemas/caixas";
import { Button } from "~/components/Button";
import { Input } from "~/components/Input";

export function meta(_args: Route.MetaArgs) {
  return [{ title: "Nova Caixa — Financeiro — Igreja Conect" }];
}

/**
 * Loader: verifica permissão para criar caixas.
 */
export async function loader({ context }: Route.LoaderArgs) {
  const user = context.get(userContext);
  if (!user) throw new Response("Não autenticado.", { status: 401 });
  assertCanManageCaixa(user);
  return { user };
}

/**
 * Action: valida input e cria caixa.
 */
export async function action({ request, context }: Route.ActionArgs) {
  const user = context.get(userContext);
  if (!user) throw new Response("Não autenticado.", { status: 401 });
  assertCanManageCaixa(user);

  const formData = await request.formData();
  const raw: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") raw[key] = value;
  }

  const parsed = CaixaCreateSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const path = issue.path.join(".");
      if (path && !fieldErrors[path]) {
        fieldErrors[path] = issue.message;
      }
    }
    return data({ ok: false as const, fieldErrors, formError: null }, { status: 422 });
  }

  try {
    const caixa = await criarCaixa(parsed.data, user) as { id: string };
    return redirect(`/app/financeiro/caixas/${caixa.id}`);
  } catch (e) {
    if (e instanceof Response) {
      if (e.status === 409) {
        const text = await e.text().catch(() => "Nome já em uso.");
        return data({ ok: false as const, fieldErrors: null, formError: text }, { status: 409 });
      }
      throw e; // 403, 404, etc.
    }
    throw e;
  }
}

/**
 * Página de criação de caixa — layout alinhado ao Novo Lançamento.
 */
export default function NovaCaixa() {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const fieldErrors: Record<string, string> =
    (actionData as { fieldErrors?: Record<string, string> } | undefined)
      ?.fieldErrors ?? {};
  const formError =
    (actionData as { formError?: string | null } | undefined)?.formError ?? null;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Novo Caixa</h1>
          <p className="text-slate-600 mt-1">Crie uma nova conta para organizar as finanças da igreja.</p>
        </div>
        <Button as={Link} to="/app/financeiro/caixas" variant="secondary" size="sm">
          Cancelar
        </Button>
      </div>

      <form method="POST" noValidate className="space-y-6">
        {formError && (
          <div role="alert" className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800">
            {formError}
          </div>
        )}

        {/* Informações Básicas */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center gap-2">
            <svg className="h-5 w-5 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 16v-4M12 8h.01" />
            </svg>
            <h2 className="font-semibold text-slate-900">Informações Básicas</h2>
          </div>
          <div className="p-6 space-y-5">
            <Input
              name="nome"
              label="Nome do Caixa"
              placeholder="Ex: Conta Principal (Bradesco)"
              maxLength={80}
              defaultValue=""
              error={fieldErrors.nome}
              required
            />
          </div>
        </div>

        {/* Ações */}
        <div className="flex items-center gap-3">
          <Button type="submit" loading={isSubmitting} className="flex-1">
            Criar Caixa
          </Button>
          <Button as={Link} to="/app/financeiro/caixas" variant="secondary">
            Cancelar
          </Button>
        </div>
      </form>
    </div>
  );
}
