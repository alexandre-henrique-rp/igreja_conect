/**
 * Rota /app/patrimonio/novo — cadastrar patrimônio (`patrimonio-novo.html` do DS).
 *
 * Cria um `ItemEstoque` com `tipo = PATRIMONIO` via `criarItem` (RN-EST-01:
 * sempre 1 unidade, status inicial DISPONIVEL). O "número de patrimônio" é o
 * `numeroSerie` (único). Valor de aquisição é digitado em reais e gravado em
 * centavos.
 */
import { Form, Link, data, redirect, useNavigation } from "react-router";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbSeparator,
  Button,
  Card,
  Input,
  PageHeader,
  Textarea,
} from "~/components/ds";
import { criarItem } from "~/lib/itemEstoque.server";
import { parseBRLToCents } from "~/lib/money-format";
import { assertCanManageEstoque } from "~/lib/rbac.server";
import { ItemEstoqueCreateSchema } from "~/lib/schemas/estoque";
import { userContext } from "~/lib/user-context";
import type { Route } from "./+types/patrimonio.novo";

export function meta(_args: Route.MetaArgs) {
  return [{ title: "Novo patrimônio · Igreja Conect" }];
}

export async function loader({ context }: Route.LoaderArgs) {
  const user = context.get(userContext);
  if (!user) throw new Response("Não autenticado.", { status: 401 });
  assertCanManageEstoque(user);
  return null;
}

export async function action({ request, context }: Route.ActionArgs) {
  const user = context.get(userContext);
  if (!user) throw new Response("Não autenticado.", { status: 401 });
  assertCanManageEstoque(user);

  const raw = Object.fromEntries(await request.formData()) as Record<string, string>;
  const opcional = (v: string | undefined) => (v && v.trim() ? v.trim() : undefined);

  // Valor em reais ("4.800,00") -> centavos; vazio = não informado.
  const valorCentavos = parseBRLToCents(raw.valor ?? "");
  const valorInvalido = (raw.valor ?? "").trim() !== "" && valorCentavos === null;

  const parsed = ItemEstoqueCreateSchema.safeParse({
    tipo: "PATRIMONIO",
    nome: (raw.nome ?? "").trim(),
    numeroSerie: (raw.numeroSerie ?? "").trim(),
    localizacaoFisica: opcional(raw.localizacaoFisica),
    descricao: opcional(raw.descricao),
    categoria: raw.categoria,
    dataAquisicao: raw.dataAquisicao,
    valorAquisicaoCentavos: valorCentavos ?? undefined,
    notaFiscal: raw.notaFiscal,
    fimGarantia: raw.fimGarantia,
    vidaUtilAnos: raw.vidaUtilAnos,
    responsavelPatrimonio: raw.responsavelPatrimonio,
  });
  if (!parsed.success || valorInvalido) {
    const fieldErrors = (parsed.success ? {} : parsed.error.flatten().fieldErrors) as Record<string, string[] | undefined>;
    if (valorInvalido) fieldErrors.valor = ["Informe um valor válido, como 4.800,00."];
    return data({ fieldErrors, values: raw }, { status: 422 });
  }

  try {
    const item = await criarItem(parsed.data, user);
    return redirect(`/app/patrimonio/${item.id}`);
  } catch (e) {
    if (e instanceof Response && e.status === 409) {
      return data(
        {
          fieldErrors: {
            numeroSerie: ["Este número de patrimônio já está cadastrado."],
          } as Record<string, string[] | undefined>,
          values: raw,
        },
        { status: 409 },
      );
    }
    throw e;
  }
}

export default function NovoPatrimonio({ actionData }: Route.ComponentProps) {
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const fieldErrors = actionData && "fieldErrors" in actionData ? actionData.fieldErrors : undefined;
  const v = (actionData && "values" in actionData ? actionData.values : undefined) as
    | Record<string, string>
    | undefined;

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6 lg:p-8" data-od-id="new-asset-page">
      <Breadcrumb>
        <BreadcrumbItem href="/app/patrimonio">Patrimônio</BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem current>Novo patrimônio</BreadcrumbItem>
      </Breadcrumb>

      <PageHeader title="Cadastrar patrimônio" description="Registre o bem e onde ele fica guardado." />

      <Form method="post" noValidate data-od-id="new-asset-form">
        <Card padding="lg" className="space-y-6">
          <section aria-labelledby="pat-id" className="space-y-4">
            <h2 id="pat-id" className="text-base font-extrabold text-fg">
              Identificação do bem
            </h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Input
                name="nome"
                label="Nome do patrimônio"
                placeholder="Ex.: Projetor Epson"
                defaultValue={v?.nome ?? ""}
                error={fieldErrors?.nome?.[0]}
                required
                autoFocus
              />
              <Input
                name="numeroSerie"
                label="Número de patrimônio"
                placeholder="PAT-0000"
                defaultValue={v?.numeroSerie ?? ""}
                error={fieldErrors?.numeroSerie?.[0]}
                required
              />
            </div>
          </section>

          <section aria-labelledby="pat-aquisicao" className="space-y-4">
            <h2 id="pat-aquisicao" className="text-base font-extrabold text-fg">
              Aquisição
            </h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Input
                name="categoria"
                label="Categoria"
                placeholder="Ex.: Equipamentos"
                defaultValue={v?.categoria ?? ""}
                error={fieldErrors?.categoria?.[0]}
              />
              <Input
                name="dataAquisicao"
                label="Data de aquisição"
                type="date"
                defaultValue={v?.dataAquisicao ?? ""}
                error={fieldErrors?.dataAquisicao?.[0]}
              />
              <Input
                name="valor"
                label="Valor de aquisição (R$)"
                inputMode="decimal"
                placeholder="0,00"
                defaultValue={v?.valor ?? ""}
                error={fieldErrors?.valor?.[0] ?? fieldErrors?.valorAquisicaoCentavos?.[0]}
              />
              <Input
                name="notaFiscal"
                label="Nota fiscal"
                placeholder="Número da nota fiscal"
                defaultValue={v?.notaFiscal ?? ""}
                error={fieldErrors?.notaFiscal?.[0]}
              />
              <Input
                name="fimGarantia"
                label="Fim da garantia"
                type="date"
                defaultValue={v?.fimGarantia ?? ""}
                error={fieldErrors?.fimGarantia?.[0]}
              />
              <Input
                name="vidaUtilAnos"
                label="Vida útil estimada (anos)"
                type="number"
                min={1}
                max={100}
                placeholder="Ex.: 5"
                defaultValue={v?.vidaUtilAnos ?? ""}
                error={fieldErrors?.vidaUtilAnos?.[0]}
              />
            </div>
          </section>

          <section aria-labelledby="pat-local" className="space-y-4">
            <h2 id="pat-local" className="text-base font-extrabold text-fg">
              Custódia e localização
            </h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Input
                name="localizacaoFisica"
                label="Localização atual"
                placeholder="Ex.: Salão principal"
                defaultValue={v?.localizacaoFisica ?? ""}
                error={fieldErrors?.localizacaoFisica?.[0]}
              />
              <Input
                name="responsavelPatrimonio"
                label="Responsável"
                placeholder="Pessoa ou ministério"
                defaultValue={v?.responsavelPatrimonio ?? ""}
                error={fieldErrors?.responsavelPatrimonio?.[0]}
              />
            </div>
            <Textarea
              name="descricao"
              label="Observações"
              rows={3}
              placeholder="Inclua condições, cuidados especiais ou onde o bem deve ser guardado"
              defaultValue={v?.descricao ?? ""}
              error={fieldErrors?.descricao?.[0]}
            />
          </section>

          <div className="flex flex-col-reverse gap-2 border-t border-border pt-5 sm:flex-row sm:justify-end">
            <Button as={Link} to="/app/patrimonio" variant="secondary">
              Cancelar
            </Button>
            <Button type="submit" variant="primary" loading={isSubmitting}>
              {isSubmitting ? "Salvando..." : "Salvar patrimônio"}
            </Button>
          </div>
        </Card>
      </Form>
    </div>
  );
}
