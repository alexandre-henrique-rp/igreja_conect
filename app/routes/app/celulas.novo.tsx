/**
 * Rota /app/celulas/novo — cadastrar nova célula (`celula-nova.html` do DS).
 *
 * Loader: lista membros elegíveis a líder (não visitantes e que ainda não
 * lideram outra célula — `Celula.liderId` é único).
 * Action: valida (Zod) → `criarCelula` (RBAC ADMIN/PASTOR/SECRETARIO) → detalhe.
 */
import { data, redirect } from "react-router";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbSeparator,
  PageHeader,
} from "~/components/ds";
import { FormCelula } from "~/components/FormCelula";
import { prisma } from "~/db/prisma.server";
import { criarCelula } from "~/lib/celulas.server";
import { BusinessRuleError, NotFoundError } from "~/lib/errors";
import { CelulaFormSchema } from "~/lib/schemas/celulas";
import { userContext } from "~/lib/user-context";
import type { Route } from "./+types/celulas.novo";

export function meta(_args: Route.MetaArgs) {
  return [{ title: "Nova célula · Igreja Conect" }];
}

export async function loader({ context }: Route.LoaderArgs) {
  const user = context.get(userContext);
  if (!user) throw new Response("Não autenticado.", { status: 401 });

  const lideres = await prisma.membro.findMany({
    where: { tipo: { not: "VISITANTE" }, celulaLiderada: null },
    select: { id: true, nome: true },
    orderBy: { nome: "asc" },
    take: 500,
  });
  return { lideres };
}

export async function action({ request, context }: Route.ActionArgs) {
  const user = context.get(userContext);
  if (!user) throw new Response("Não autenticado.", { status: 401 });

  const values = Object.fromEntries(await request.formData());
  const parsed = CelulaFormSchema.safeParse(values);
  if (!parsed.success) {
    return data(
      {
        fieldErrors: parsed.error.flatten().fieldErrors,
        values: values as Record<string, string>,
      },
      { status: 422 },
    );
  }

  try {
    const celula = await criarCelula(parsed.data, user);
    return redirect(`/app/celulas/${celula.id}`);
  } catch (e) {
    if (e instanceof BusinessRuleError || e instanceof NotFoundError) {
      return data(
        { formError: e.message, values: values as Record<string, string> },
        { status: e instanceof NotFoundError ? 404 : 409 },
      );
    }
    // P2002: `Celula.liderId` é único — o membro já lidera outra célula.
    if ((e as { code?: string })?.code === "P2002") {
      return data(
        {
          formError: "Este membro já lidera outra célula.",
          values: values as Record<string, string>,
        },
        { status: 409 },
      );
    }
    throw e;
  }
}

export default function NovaCelula({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const fieldErrors =
    actionData && "fieldErrors" in actionData
      ? actionData.fieldErrors
      : undefined;
  const formError =
    actionData && "formError" in actionData ? actionData.formError : undefined;
  const values =
    actionData && "values" in actionData ? actionData.values : undefined;

  return (
    <div
      className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6 lg:p-8"
      data-od-id="new-cell-page"
    >
      <Breadcrumb>
        <BreadcrumbItem href="/app/celulas">Células</BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem current>Nova célula</BreadcrumbItem>
      </Breadcrumb>

      <PageHeader
        title="Cadastrar nova célula"
        description="Crie o grupo, defina sua liderança e organize o primeiro encontro."
      />

      <FormCelula
        lideres={loaderData.lideres}
        defaultValues={values}
        fieldErrors={fieldErrors}
        formError={formError}
        submitLabel="Salvar célula"
        cancelTo="/app/celulas"
      />
    </div>
  );
}
