/**
 * Rota /app/celulas/:id/editar — editar célula (reusa `FormCelula`).
 *
 * Campos esvaziados no formulário limpam o valor no banco (o service grava
 * `null` quando recebe `""`).
 */
import { data, redirect } from "react-router";
import { Breadcrumb, BreadcrumbItem, BreadcrumbSeparator, PageHeader } from "~/components/ds";
import { FormCelula } from "~/components/FormCelula";
import { prisma } from "~/db/prisma.server";
import { buscarCelula, editarCelula } from "~/lib/celulas.server";
import { BusinessRuleError, NotFoundError } from "~/lib/errors";
import { CelulaFormSchema } from "~/lib/schemas/celulas";
import { userContext } from "~/lib/user-context";
import type { Route } from "./+types/celulas.$id.editar";

export function meta(_args: Route.MetaArgs) {
  return [{ title: "Editar célula · Igreja Conect" }];
}

export async function loader({ params, context }: Route.LoaderArgs) {
  const user = context.get(userContext);
  if (!user) throw new Response("Não autenticado.", { status: 401 });

  try {
    const celula = await buscarCelula(params.id, user);
    const lideres = await prisma.membro.findMany({
      where: {
        tipo: { not: "VISITANTE" },
        OR: [{ celulaLiderada: null }, { celulaLiderada: { is: { id: params.id } } }],
      },
      select: { id: true, nome: true },
      orderBy: { nome: "asc" },
      take: 500,
    });
    return { celula, lideres };
  } catch (e) {
    if (e instanceof NotFoundError) throw new Response("Célula não encontrada.", { status: 404 });
    throw e;
  }
}

export async function action({ request, params, context }: Route.ActionArgs) {
  const user = context.get(userContext);
  if (!user) throw new Response("Não autenticado.", { status: 401 });

  const values = Object.fromEntries(await request.formData());
  const parsed = CelulaFormSchema.safeParse(values);
  if (!parsed.success) {
    return data(
      { fieldErrors: parsed.error.flatten().fieldErrors, values: values as Record<string, string> },
      { status: 422 },
    );
  }

  try {
    // "" (≠ undefined) instrui o service a limpar o campo.
    await editarCelula(
      params.id,
      {
        nome: parsed.data.nome,
        liderId: parsed.data.liderId ?? "",
        endereco: parsed.data.endereco ?? "",
        diaSemana: parsed.data.diaSemana ?? "",
        horario: parsed.data.horario ?? "",
        descricao: parsed.data.descricao ?? "",
        regiao: parsed.data.regiao ?? "",
        status: parsed.data.status,
        capacidade: parsed.data.capacidade ?? 0,
      },
      user,
    );
    return redirect(`/app/celulas/${params.id}`);
  } catch (e) {
    if (e instanceof NotFoundError) throw new Response("Célula não encontrada.", { status: 404 });
    if (e instanceof BusinessRuleError) {
      return data({ formError: e.message, values: values as Record<string, string> }, { status: 409 });
    }
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

export default function EditarCelula({ loaderData, actionData }: Route.ComponentProps) {
  const { celula, lideres } = loaderData;
  const fieldErrors = actionData && "fieldErrors" in actionData ? actionData.fieldErrors : undefined;
  const formError = actionData && "formError" in actionData ? actionData.formError : undefined;
  const values = actionData && "values" in actionData ? actionData.values : undefined;

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6 lg:p-8" data-od-id="edit-cell-page">
      <Breadcrumb>
        <BreadcrumbItem href="/app/celulas">Células</BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem href={`/app/celulas/${celula.id}`}>{celula.nome}</BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem current>Editar</BreadcrumbItem>
      </Breadcrumb>

      <PageHeader
        title="Editar célula"
        description="Atualize os dados do grupo, a liderança e a agenda dos encontros."
      />

      <FormCelula
        lideres={lideres}
        defaultValues={
          values ?? {
            nome: celula.nome,
            liderId: celula.lider?.id ?? "",
            endereco: celula.endereco,
            diaSemana: celula.diaSemana,
            horario: celula.horario,
            descricao: celula.descricao,
            regiao: celula.regiao,
            status: celula.status,
            capacidade: celula.capacidade,
          }
        }
        fieldErrors={fieldErrors}
        formError={formError}
        submitLabel="Salvar alterações"
        cancelTo={`/app/celulas/${celula.id}`}
      />
    </div>
  );
}
