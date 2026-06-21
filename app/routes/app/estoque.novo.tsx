import type { Route } from "./+types/estoque.novo";
import { Form, Link, useActionData, useNavigation, redirect } from "react-router";
import { useState } from "react";
import { userContext } from "~/lib/user-context";
import { assertCanManageEstoque } from "~/lib/rbac.server";
import { criarItem } from "~/lib/itemEstoque.server";
import { ItemEstoqueCreateSchema } from "~/lib/schemas/estoque";

export function meta() {
  return [{ title: "Novo Produto · Estoque · Igreja Conect" }];
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const user = context.get(userContext);
  if (!user) throw new Response("Não autenticado.", { status: 401 });
  assertCanManageEstoque(user);
  return { user };
}

export async function action({ request, context }: Route.ActionArgs) {
  const user = context.get(userContext);
  if (!user) throw new Response("Não autenticado.", { status: 401 });
  assertCanManageEstoque(user);

  const formData = await request.formData();
  const raw = Object.fromEntries(formData);

  const parsed = ItemEstoqueCreateSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      fieldErrors: parsed.error.flatten().fieldErrors,
      error: "Dados inválidos. Verifique os campos.",
      values: raw,
    };
  }

  try {
    const item = await criarItem(parsed.data, user);
    return redirect(`/app/estoque/${item.id}`);
  } catch (err: any) {
    if (err instanceof Response) {
      if (err.status === 409) {
        return { success: false, error: err.statusText || "Número de série já cadastrado.", values: raw };
      }
      throw err;
    }
    return { success: false, error: err.message, values: raw };
  }
}

export default function NovoProduto({ loaderData, actionData }: Route.ComponentProps) {
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const [tipo, setTipo] = useState("CONSUMO");

  return (
    <main className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto w-full space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-xs font-semibold text-slate-400 mb-2">
        <Link to="/app/estoque" className="hover:text-blue-600 transition-colors">Estoque</Link>
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
        <span className="text-blue-600">Novo Produto</span>
      </nav>

      <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Novo Produto</h2>
      <p className="text-slate-500 text-sm">Cadastre um novo item no estoque ou patrimônio da igreja.</p>

      {actionData?.error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          {actionData.error}
        </div>
      )}

      <Form method="post" className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-8 space-y-8">
          {/* Section 1: Identificação */}
          <div>
            <h3 className="text-lg font-bold text-slate-800 mb-4">Identificação</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-slate-700 mb-2">Nome do Produto *</label>
                <input
                  name="nome"
                  type="text"
                  required
                  defaultValue={actionData?.values?.nome as string}
                  className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm"
                  placeholder="Ex: Copo Descartável 200ml"
                />
                {actionData?.fieldErrors?.nome && (
                  <p className="text-xs text-red-500 mt-1">{actionData.fieldErrors.nome}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Tipo de Item *</label>
                <select
                  name="tipo"
                  value={tipo}
                  onChange={(e) => setTipo(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm cursor-pointer"
                >
                  <option value="CONSUMO">Consumo</option>
                  <option value="PATRIMONIO">Patrimônio</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Setor / Localização</label>
                <select
                  name="localizacaoFisica"
                  className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm cursor-pointer"
                >
                  <option value="Cozinha">Cozinha</option>
                  <option value="Limpeza">Limpeza</option>
                  <option value="Escritório">Escritório</option>
                  <option value="Sonorização">Sonorização</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 2: Quantidade */}
          <div>
            <h3 className="text-lg font-bold text-slate-800 mb-4">Quantidade e Controle</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Quantidade {tipo === "PATRIMONIO" ? "" : "Inicial"}
                </label>
                <input
                  name="quantidade"
                  type="number"
                  min="0"
                  defaultValue={tipo === "PATRIMONIO" ? "1" : "0"}
                  className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Qtd Mínima (Alerta)</label>
                <input
                  name="quantidadeMinima"
                  type="number"
                  min="0"
                  defaultValue="5"
                  className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Patrimônio (condicional) */}
          {tipo === "PATRIMONIO" && (
            <div>
              <h3 className="text-lg font-bold text-slate-800 mb-4">Dados do Patrimônio</h3>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Número de Série *</label>
                <input
                  name="numeroSerie"
                  type="text"
                  maxLength={60}
                  className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm font-mono uppercase"
                  placeholder="Ex: PJ-001"
                />
                {actionData?.fieldErrors?.numeroSerie && (
                  <p className="text-xs text-red-500 mt-1">{actionData.fieldErrors.numeroSerie}</p>
                )}
              </div>
            </div>
          )}

          {/* Section 4: Descrição */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Descrição</label>
            <textarea
              name="descricao"
              className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all resize-none text-sm"
              placeholder="Descreva brevemente a finalidade ou especificações..."
              rows={3}
            />
          </div>
        </div>

        <div className="p-6 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
          <Link
            to="/app/estoque"
            className="px-6 py-2.5 text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-8 py-2.5 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 shadow-lg shadow-blue-500/30 transition-all transform active:scale-95 disabled:opacity-50"
          >
            {isSubmitting ? "Salvando..." : "Salvar Produto"}
          </button>
        </div>
      </Form>
    </main>
  );
}
