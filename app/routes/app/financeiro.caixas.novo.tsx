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
  useActionData,
  useLoaderData,
  useNavigation,
  Form,
  Link,
  redirect,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "react-router";
import type { Route } from "./+types/financeiro.caixas.novo";
import { userContext } from "~/lib/user-context";
import { assertCanManageCaixa } from "~/lib/rbac.server";
import { criarCaixa } from "~/lib/caixas.server";
import { CaixaCreateSchema, type CaixaCreateInput } from "~/lib/schemas/caixas";
import { PageHeader } from "~/components/PageHeader";
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
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const path = issue.path.join(".");
      if (!fieldErrors[path]) fieldErrors[path] = [];
      fieldErrors[path].push(issue.message);
    }
    return { ok: false as const, fieldErrors, formError: null };
  }

  try {
    const caixa = await criarCaixa(parsed.data, user) as { id: string };
    return redirect(`/app/financeiro/caixas/${caixa.id}`);
  } catch (e) {
    if (e instanceof Response) {
      if (e.status === 409) {
        const text = await e.text().catch(() => "Nome já em uso.");
        return { ok: false as const, fieldErrors: null, formError: text };
      }
      throw e; // 403, 404, etc.
    }
    throw e;
  }
}

/**
 * Página de criação de caixa.
 */
export default function NovaCaixa() {
  const { user } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto">
      <PageHeader title="Nova Caixa" />

      <Form method="post" className="space-y-4" noValidate>
        {actionData?.formError && (
          <div
            role="alert"
            className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-800"
          >
            {actionData.formError}
          </div>
        )}

        <Input
          label="Nome do Caixa"
          name="nome"
          required
          placeholder="Ex: Caixa da Cantina"
          maxLength={80}
          error={actionData?.fieldErrors?.nome?.[0]}
        />

        <div className="flex items-center gap-3 pt-2">
          <Button type="submit" loading={isSubmitting}>
            Criar Caixa
          </Button>
          <Button variant="ghost" as={Link} to="/app/financeiro/caixas">
            Cancelar
          </Button>
        </div>
      </Form>
    </div>
  );
}
