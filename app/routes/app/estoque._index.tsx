import type { Route } from "./+types/estoque._index";
import { Link, useSubmit, useNavigate, Form, useActionData, useNavigation } from "react-router";
import { useState } from "react";
import { z } from "zod";
import { prisma } from "~/db/prisma.server";
import { userContext } from "~/lib/user-context";
import KpiEstoque from "~/components/KpiEstoque";
import TabelaItensEstoque from "~/components/TabelaItensEstoque";
import ItemEstoqueSearchBar from "~/components/ItemEstoqueSearchBar";
import {
  getDashboardEstoque,
  listarItensEstoque,
  criarItem,
  editarItem,
  arquivarItem,
  reabrirItem,
  excluirItem,
} from "~/lib/itemEstoque.server";
import { safeLog } from "~/lib/audit.server";
import { assertCanSeeEstoque, assertCanManageEstoque } from "~/lib/rbac.server";

const MovimentacaoSchema = z.object({
  itemEstoqueId: z.string().uuid("Item inválido."),
  tipo: z.enum(["ENTRADA", "SAIDA"]),
  quantidade: z.coerce.number().int().positive("A quantidade deve ser maior que zero."),
  data: z.string().min(1, "A data é obrigatória."),
  nomeRetirante: z.string().optional(),
  observacao: z.string().optional(),
});

const CriarItemSchema = z.object({
  nome: z.string().min(2, "O nome do produto deve ter pelo menos 2 caracteres."),
  tipo: z.enum(["CONSUMO", "PATRIMONIO"]),
  quantidade: z.coerce.number().int().nonnegative("A quantidade inicial não pode ser negativa."),
  quantidadeMinima: z.coerce.number().int().nonnegative("A quantidade mínima não pode ser negativa."),
  localizacaoFisica: z.string().min(1, "O setor é obrigatório."),
  descricao: z.string().optional(),
});

const EditarItemSchema = z.object({
  id: z.string().uuid("ID inválido."),
  nome: z.string().min(2, "O nome do produto deve ter pelo menos 2 caracteres."),
  tipo: z.enum(["CONSUMO", "PATRIMONIO"]),
  localizacaoFisica: z.string().min(1, "O setor é obrigatório."),
  descricao: z.string().optional(),
  quantidade: z.coerce.number().int().nonnegative("A quantidade não pode ser negativa."),
  quantidadeMinima: z.coerce.number().int().nonnegative("A quantidade mínima não pode ser negativa."),
});

export function meta() {
  return [{ title: "Estoque · Igreja Conect" }];
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const user = context.get(userContext);
  if (!user) throw new Response("Não autenticado.", { status: 401 });
  assertCanSeeEstoque(user);

  const url = new URL(request.url);
  const q = url.searchParams.get("q") || "";
  const tipo = url.searchParams.get("tipo") || "";
  const mostrarArquivados = url.searchParams.get("mostrarArquivados") === "true";
  const filtro = url.searchParams.get("filtro") || "";

  const count = await prisma.itemEstoque.count();
  if (count === 0) {
    await prisma.$transaction([
      prisma.itemEstoque.create({
        data: { nome: "Café em Grãos (1kg)", descricao: "Copa e cozinha da igreja", tipo: "CONSUMO", quantidade: 3, localizacaoFisica: "Cozinha" },
      }),
      prisma.itemEstoque.create({
        data: { nome: "Papel A4 (Pacote 500fls)", descricao: "Secretaria e recepção", tipo: "CONSUMO", quantidade: 45, localizacaoFisica: "Escritório" },
      }),
      prisma.itemEstoque.create({
        data: { nome: "Detergente Neutro (5L)", descricao: "Insumo de limpeza", tipo: "CONSUMO", quantidade: 2, localizacaoFisica: "Limpeza" },
      }),
      prisma.itemEstoque.create({
        data: { nome: "Cabo XLR 10m", descricao: "Equipamento de áudio profissional", tipo: "PATRIMONIO", quantidade: 12, localizacaoFisica: "Sonorização", numeroSerie: "XLR-AUDIO-10M-0012" },
      }),
    ]);
  }

  const [dashboard, listResult] = await Promise.all([
    getDashboardEstoque(user),
    listarItensEstoque({
      q: q || undefined,
      tipo: (tipo as "CONSUMO" | "PATRIMONIO") || undefined,
      apenasAtivos: !mostrarArquivados,
      filtro: (filtro as "critico") || undefined,
      pageSize: 100,
    }, user),
  ]);

  return {
    user,
    items: listResult.items,
    q,
    tipo,
    mostrarArquivados,
    filtro,
    kpis: dashboard.kpis,
    podeGerenciar: !!(user.cargo && ["ADMIN", "PASTOR", "SECRETARIO"].includes(user.cargo)),
  };
}

export async function action({ request, context }: Route.ActionArgs) {
  const user = context.get(userContext);
  if (!user) throw new Response("Não autenticado.", { status: 401 });
  assertCanSeeEstoque(user);

  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "arquivar") {
    assertCanManageEstoque(user);
    const id = formData.get("id") as string;
    try {
      await arquivarItem(id, user);
      return { success: true, message: "Item arquivado com sucesso!", intent: "arquivar" };
    } catch (err: any) {
      if (err instanceof Response) throw err;
      return { success: false, error: "Não foi possível arquivar o item. Verifique se ele está em manutenção.", intent: "arquivar" };
    }
  }

  if (intent === "reabrir") {
    assertCanManageEstoque(user);
    const id = formData.get("id") as string;
    try {
      await reabrirItem(id, user);
      return { success: true, message: "Item reaberto com sucesso!", intent: "reabrir" };
    } catch (err: any) {
      if (err instanceof Response) throw err;
      return { success: false, error: "Não foi possível reabrir o item. Tente novamente.", intent: "reabrir" };
    }
  }

  let adminId = user.id;
  const dbUser = await prisma.membro.findFirst({ where: { cargo: { not: null } } });
  if (dbUser) adminId = dbUser.id;

  if (intent === "movimentacao") {
    assertCanManageEstoque(user);
    const raw = {
      itemEstoqueId: formData.get("itemEstoqueId"),
      tipo: formData.get("tipo"),
      quantidade: formData.get("quantidade"),
      data: formData.get("data"),
      nomeRetirante: formData.get("nomeRetirante"),
      observacao: formData.get("observacao"),
    };

    const parsed = MovimentacaoSchema.safeParse(raw);
    if (!parsed.success) {
      return {
        success: false,
        error: "Dados de movimentação inválidos.",
        fieldErrors: parsed.error.flatten().fieldErrors,
        intent: "movimentacao",
      };
    }

    const { itemEstoqueId, tipo, quantidade, nomeRetirante, observacao } = parsed.data;

    try {
      const item = await prisma.itemEstoque.findUnique({ where: { id: itemEstoqueId } });
      if (!item) {
        return { success: false, error: "Produto não encontrado.", intent: "movimentacao" };
      }

      let novaQuantidade = item.quantidade;

      if (tipo === "SAIDA") {
        if (item.quantidade < quantidade) {
          return {
            success: false,
            error: `Quantidade insuficiente em estoque. Saldo atual: ${item.quantidade} unidade(s).`,
            intent: "movimentacao",
          };
        }
        novaQuantidade = item.quantidade - quantidade;
      } else {
        novaQuantidade = item.quantidade + quantidade;
      }

      const movimento = await prisma.movimentacaoEstoque.create({
        data: {
          itemEstoqueId,
          quantidade: tipo === "SAIDA" ? -quantidade : quantidade,
          justificativa: observacao || (tipo === "ENTRADA" ? "Entrada de estoque" : "Saída de estoque"),
          autorizadoPorId: adminId,
          nomeRetirante: nomeRetirante || user.nome,
        },
      });

      await prisma.itemEstoque.update({
        where: { id: itemEstoqueId },
        data: { quantidade: novaQuantidade },
      });

      await safeLog({
        action: "movimentacao_estoque",
        resource: `item_estoque:${itemEstoqueId}`,
        userId: user.id,
        result: "ok",
      });

      return { success: true, message: "Movimentação registrada com sucesso!", intent: "movimentacao" };
    } catch (err: any) {
      if (err instanceof Response) throw err;
      return { success: false, error: "Erro ao registrar a movimentação. Tente novamente.", intent: "movimentacao" };
    }
  }

  if (intent === "criar") {
    assertCanManageEstoque(user);
    const raw = {
      nome: formData.get("nome"),
      tipo: formData.get("tipo"),
      quantidade: formData.get("quantidade"),
      quantidadeMinima: formData.get("quantidadeMinima"),
      localizacaoFisica: formData.get("localizacaoFisica"),
      descricao: formData.get("descricao"),
      numeroSerie: formData.get("numeroSerie"),
    };

    const parsed = CriarItemSchema.safeParse(raw);
    if (!parsed.success) {
      return {
        success: false,
        error: "Dados de cadastro inválidos.",
        fieldErrors: parsed.error.flatten().fieldErrors,
        intent: "criar",
      };
    }

    try {
      const itemData = parsed.data.tipo === "PATRIMONIO"
        ? {
            nome: parsed.data.nome,
            tipo: "PATRIMONIO" as const,
            quantidade: parsed.data.quantidade,
            quantidadeMinima: parsed.data.quantidadeMinima,
            localizacaoFisica: parsed.data.localizacaoFisica,
            descricao: parsed.data.descricao,
            numeroSerie: raw.numeroSerie ? String(raw.numeroSerie) : "",
            statusPatrimonio: "DISPONIVEL" as const,
          }
        : {
            nome: parsed.data.nome,
            tipo: "CONSUMO" as const,
            quantidade: parsed.data.quantidade,
            quantidadeMinima: parsed.data.quantidadeMinima,
            localizacaoFisica: parsed.data.localizacaoFisica,
            descricao: parsed.data.descricao,
          };
      const item = await criarItem(itemData, user);
      return { success: true, message: "Produto cadastrado com sucesso!", intent: "criar", id: item.id };
    } catch (err: any) {
      if (err instanceof Response) throw err;
      return { success: false, error: "Erro ao cadastrar produto. Verifique os dados e tente novamente.", intent: "criar" };
    }
  }

  if (intent === "editar") {
    assertCanManageEstoque(user);
    const raw = {
      id: formData.get("id"),
      nome: formData.get("nome"),
      tipo: formData.get("tipo"),
      quantidade: formData.get("quantidade"),
      quantidadeMinima: formData.get("quantidadeMinima"),
      localizacaoFisica: formData.get("localizacaoFisica"),
      descricao: formData.get("descricao"),
    };

    const parsed = EditarItemSchema.safeParse(raw);
    if (!parsed.success) {
      return {
        success: false,
        error: "Dados de edição inválidos.",
        fieldErrors: parsed.error.flatten().fieldErrors,
        intent: "editar",
      };
    }

    try {
      await editarItem(
        parsed.data.id,
        {
          nome: parsed.data.nome,
          quantidade: parsed.data.quantidade,
          quantidadeMinima: parsed.data.quantidadeMinima,
          localizacaoFisica: parsed.data.localizacaoFisica,
          descricao: parsed.data.descricao,
        },
        user
      );
      return { success: true, message: "Produto atualizado com sucesso!", intent: "editar" };
    } catch (err: any) {
      if (err instanceof Response) throw err;
      return { success: false, error: "Erro ao atualizar produto. Verifique os dados e tente novamente.", intent: "editar" };
    }
  }

  if (intent === "excluir-permanente") {
    assertCanManageEstoque(user);
    const id = formData.get("id") as string;
    if (!id) return { success: false, error: "ID do produto inválido.", intent: "excluir-permanente" };

    try {
      await excluirItem(id, user);
      return { success: true, message: "Produto excluído permanentemente!", intent: "excluir-permanente" };
    } catch (err: any) {
      if (err instanceof Response) throw err;
      return {
        success: false,
        error: "Não foi possível excluir o produto. Tente novamente.",
        intent: "excluir-permanente",
      };
    }
  }

  return { success: false, error: "Operação inválida.", intent: String(intent) };
}

export default function EstoqueDashboard({ loaderData }: Route.ComponentProps) {
  const { items, q, tipo, mostrarArquivados, filtro, kpis, podeGerenciar } = loaderData;
  const actionData = useActionData<any>();
  const submit = useSubmit();
  const navigate = useNavigate();
  const navigation = useNavigation();

  const [isMovModalOpen, setIsMovModalOpen] = useState(false);
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const [selectedItem, setSelectedItem] = useState<{ id: string; nome: string; quantidade: number } | null>(null);
  const [editingProduct, setEditingProduct] = useState<{
    id: string;
    nome: string;
    tipo: "CONSUMO" | "PATRIMONIO";
    quantidade: number;
    quantidadeMinima: number;
    localizacaoFisica: string;
    descricao: string;
  } | null>(null);

  if (actionData?.success && isMovModalOpen) setIsMovModalOpen(false);
  if (actionData?.success && isNewModalOpen) setIsNewModalOpen(false);
  if (actionData?.success && isEditModalOpen) setIsEditModalOpen(false);

  const handleOpenMovModal = (item: { id: string; nome: string; quantidade: number } | null) => {
    setSelectedItem(item);
    setIsMovModalOpen(true);
  };

  const handleOpenEditModal = (item: any) => {
    setEditingProduct({
      id: item.id,
      nome: item.nome,
      tipo: item.tipo,
      quantidade: item.quantidade,
      quantidadeMinima: item.quantidadeMinima,
      localizacaoFisica: item.localizacaoFisica || "",
      descricao: item.descricao || "",
    });
    setIsEditModalOpen(true);
  };

  const handleArquivar = (id: string) => {
    const fd = new FormData();
    fd.append("intent", "arquivar");
    fd.append("id", id);
    submit(fd, { method: "post" });
  };

  const handleReabrir = (id: string) => {
    const fd = new FormData();
    fd.append("intent", "reabrir");
    fd.append("id", id);
    submit(fd, { method: "post" });
  };

  const handleExcluir = (id: string) => {
    if (!confirm("Tem certeza? Esta ação exclui o item permanentemente e não pode ser desfeita.")) return;
    const fd = new FormData();
    fd.append("intent", "excluir-permanente");
    fd.append("id", id);
    submit(fd, { method: "post" });
  };

  const todayStr = new Date().toISOString().split("T")[0];

  return (
    <main id="main-content" className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6 bg-slate-50 min-h-screen">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <nav className="flex items-center gap-2 text-xs font-semibold text-slate-400 mb-2">
            <span>Estoque</span>
            <svg className="w-3 h-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
            <span className="text-blue-600">Visão Geral</span>
          </nav>
          <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Estoque</h2>
          <p className="text-slate-500 text-sm mt-1">Gerencie os produtos e insumos da igreja.</p>
        </div>
        <div className="flex items-center gap-3">
          {podeGerenciar && (
            <>
              <Link
                to="/app/estoque/requisicoes"
                className="flex items-center justify-center gap-2 px-4 h-10 border border-slate-200 text-slate-700 bg-white rounded-lg font-semibold hover:bg-slate-50 transition-all text-sm"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                Requisições
              </Link>
              <button
                type="button"
                onClick={() => navigate(mostrarArquivados ? "/app/estoque" : "/app/estoque?mostrarArquivados=true")}
                className={`flex items-center justify-center gap-2 px-4 h-10 border rounded-lg font-semibold transition-all text-sm cursor-pointer ${
                  mostrarArquivados
                    ? "border-amber-300 text-amber-700 bg-amber-50"
                    : "border-slate-200 text-slate-600 bg-white hover:bg-slate-50"
                }`}
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 21v-8H7v8M7 3v5h8" />
                </svg>
                {mostrarArquivados ? "Ver Ativos" : "Arquivados"}
              </button>
              <Link
                to="/app/estoque/novo"
                className="flex items-center justify-center gap-2 px-4 h-10 border border-slate-200 text-slate-700 bg-white rounded-lg font-semibold hover:bg-slate-50 transition-all text-sm"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Novo Produto
              </Link>
              <button
                type="button"
                className="flex items-center justify-center gap-2 px-5 h-10 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 shadow-sm shadow-blue-500/20 transition-all text-sm cursor-pointer"
                onClick={() => setIsNewModalOpen(true)}
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Cadastro Rápido
              </button>
            </>
          )}
        </div>
      </div>

      {actionData?.error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
          <svg className="w-5 h-5 text-red-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <p className="text-sm font-semibold text-red-800">Falha na operação</p>
            <p className="text-xs text-red-700 mt-1">{actionData.error}</p>
          </div>
        </div>
      )}

      {actionData?.success && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-3">
          <svg className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="text-sm font-semibold text-emerald-800">Sucesso</p>
            <p className="text-xs text-emerald-700 mt-0.5">{actionData.message}</p>
          </div>
        </div>
      )}

      <KpiEstoque kpis={kpis} />

      {filtro === "critico" && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-red-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <p className="text-sm font-semibold text-red-800">Itens com estoque crítico</p>
              <p className="text-xs text-red-700 mt-0.5">Mostrando apenas itens de consumo com quantidade ≤ 5.</p>
            </div>
          </div>
          <Link
            to="/app/estoque"
            className="text-sm font-semibold text-red-700 hover:text-red-800 underline shrink-0"
          >
            Ver todos
          </Link>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <ItemEstoqueSearchBar q={q} tipo={tipo} mostrarArquivados={mostrarArquivados} />
          {podeGerenciar && (
            <button
              type="button"
              className="flex items-center gap-2 px-4 py-2 border border-emerald-200 text-emerald-600 bg-emerald-50/50 rounded-lg font-bold text-sm hover:bg-emerald-50 transition-all cursor-pointer justify-center"
              onClick={() => handleOpenMovModal(null)}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
              Nova Movimentação
            </button>
          )}
        </div>

        <TabelaItensEstoque
          items={items}
          podeGerenciar={podeGerenciar}
          onArquivar={handleArquivar}
          onReabrir={handleReabrir}
          onExcluir={handleExcluir}
        />

        <div className="p-6 bg-slate-50/30 border-t border-slate-100 flex items-center justify-between">
          <p className="text-xs text-slate-500">
            Mostrando <span className="font-semibold text-slate-700">{items.length}</span> de <span className="font-semibold text-slate-700">{kpis.total}</span> produto(s)
          </p>
          <div className="flex items-center gap-2">
            <button type="button" className="px-3 py-1 border border-slate-200 bg-white rounded text-xs text-slate-400 cursor-not-allowed">Anterior</button>
            <button type="button" className="px-3 py-1 bg-blue-600 text-white rounded text-xs font-semibold">1</button>
            <button type="button" className="px-3 py-1 border border-slate-200 bg-white rounded text-xs text-slate-400 cursor-not-allowed">Próximo</button>
          </div>
        </div>
      </div>

      {isMovModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsMovModalOpen(false)}></div>
          <div className="relative bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center text-emerald-600 shrink-0">
                  <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900 font-headline">Nova Movimentação</h3>
                  <p className="text-sm text-slate-500">Registre entrada ou saída de itens.</p>
                </div>
              </div>
              <button
                type="button"
                className="p-2 text-slate-400 hover:bg-slate-200/50 rounded-lg transition-colors cursor-pointer"
                onClick={() => setIsMovModalOpen(false)}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <Form method="post">
              <input type="hidden" name="intent" value="movimentacao" />

              <div className="p-8 space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Produto</label>
                  <div className="relative">
                    <select
                      name="itemEstoqueId"
                      required
                      defaultValue={selectedItem?.id || ""}
                      className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all appearance-none text-sm cursor-pointer"
                    >
                      <option value="">Selecione um produto...</option>
                      {items.map((item: any) => (
                        <option key={item.id} value={item.id}>
                          {item.nome} (Saldo: {item.quantidade})
                        </option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-500">
                      <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                        <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
                      </svg>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-3">Tipo de Movimentação</label>
                  <div className="grid grid-cols-2 gap-4">
                    <label className="relative flex items-center justify-center gap-3 p-4 border border-slate-200 rounded-xl cursor-pointer hover:bg-emerald-50/50 transition-all has-[:checked]:border-emerald-500 has-[:checked]:bg-emerald-50 has-[:checked]:ring-2 has-[:checked]:ring-emerald-500/20">
                      <input defaultChecked className="sr-only" name="tipo" type="radio" value="ENTRADA" />
                      <svg className="w-5 h-5 text-emerald-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 13l-7 7-7-7m14-6l-7 7-7-7" />
                      </svg>
                      <span className="font-medium text-slate-700">Entrada</span>
                    </label>
                    <label className="relative flex items-center justify-center gap-3 p-4 border border-slate-200 rounded-xl cursor-pointer hover:bg-red-50/50 transition-all has-[:checked]:border-red-500 has-[:checked]:bg-red-50 has-[:checked]:ring-2 has-[:checked]:ring-red-500/20">
                      <input className="sr-only" name="tipo" type="radio" value="SAIDA" />
                      <svg className="w-5 h-5 text-red-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 11l7-7 7 7m-14 6l7-7 7 7" />
                      </svg>
                      <span className="font-medium text-slate-700">Saída</span>
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Quantidade</label>
                    <input
                      name="quantidade"
                      className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm"
                      min="1"
                      type="number"
                      defaultValue="1"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Data</label>
                    <input
                      name="data"
                      className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm"
                      type="date"
                      defaultValue={todayStr}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Observação</label>
                  <textarea
                    name="observacao"
                    className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all resize-none text-sm"
                    placeholder="Ex: Reposição mensal para o setor de cozinha..."
                    rows={3}
                  />
                </div>
              </div>

              <div className="p-6 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  className="px-6 py-2.5 text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
                  onClick={() => setIsMovModalOpen(false)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={navigation.state === "submitting"}
                  className="px-8 py-2.5 bg-blue-500 text-white rounded-xl font-bold text-sm hover:bg-blue-600 shadow-lg shadow-blue-500/30 transition-all transform active:scale-95 disabled:opacity-50"
                >
                  {navigation.state === "submitting" ? "Salvando..." : "Salvar Movimentação"}
                </button>
              </div>
            </Form>
          </div>
        </div>
      )}

      {isNewModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsNewModalOpen(false)}></div>
          <div className="relative bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600 shrink-0">
                  <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900 font-headline">Novo Produto</h3>
                  <p className="text-sm text-slate-500">Cadastre um novo item no estoque.</p>
                </div>
              </div>
              <button
                type="button"
                className="p-2 text-slate-400 hover:bg-slate-200/50 rounded-lg transition-colors cursor-pointer"
                onClick={() => setIsNewModalOpen(false)}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <Form method="post">
              <input type="hidden" name="intent" value="criar" />

              <div className="p-8 space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Nome do Produto</label>
                  <input
                    name="nome"
                    type="text"
                    required
                    placeholder="Ex: Copo Descartável 200ml"
                    className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Tipo de Item</label>
                    <div className="relative">
                      <select
                        name="tipo"
                        className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all appearance-none text-sm cursor-pointer"
                      >
                        <option value="CONSUMO">Consumo</option>
                        <option value="PATRIMONIO">Patrimônio</option>
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-500">
                        <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                          <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
                        </svg>
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Setor / Localização</label>
                    <div className="relative">
                      <select
                        name="localizacaoFisica"
                        className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all appearance-none text-sm cursor-pointer"
                      >
                        <option value="Cozinha">Cozinha</option>
                        <option value="Limpeza">Limpeza</option>
                        <option value="Escritório">Escritório</option>
                        <option value="Sonorização">Sonorização</option>
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-500">
                        <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                          <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
                        </svg>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Quantidade Inicial</label>
                    <input
                      name="quantidade"
                      type="number"
                      min="0"
                      defaultValue="0"
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
                <button
                  type="button"
                  className="px-6 py-2.5 text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
                  onClick={() => setIsNewModalOpen(false)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={navigation.state === "submitting"}
                  className="px-8 py-2.5 bg-blue-500 text-white rounded-xl font-bold text-sm hover:bg-blue-600 shadow-lg shadow-blue-500/30 transition-all transform active:scale-95 disabled:opacity-50"
                >
                  {navigation.state === "submitting" ? "Criando..." : "Salvar Produto"}
                </button>
              </div>
            </Form>
          </div>
        </div>
      )}

      {isEditModalOpen && editingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsEditModalOpen(false)}></div>
          <div className="relative bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center text-indigo-600 shrink-0">
                  <svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900 font-headline">Editar Produto</h3>
                  <p className="text-sm text-slate-500">Atualize os detalhes do item no estoque.</p>
                </div>
              </div>
              <button
                type="button"
                className="p-2 text-slate-400 hover:bg-slate-200/50 rounded-lg transition-colors cursor-pointer"
                onClick={() => setIsEditModalOpen(false)}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <Form method="post">
              <input type="hidden" name="intent" value="editar" />
              <input type="hidden" name="id" value={editingProduct.id} />

              <div className="p-8 space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Nome do Produto</label>
                  <input
                    name="nome"
                    type="text"
                    required
                    defaultValue={editingProduct.nome}
                    className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Tipo de Item</label>
                    <div className="relative">
                      <select
                        name="tipo"
                        defaultValue={editingProduct.tipo}
                        className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all appearance-none text-sm cursor-pointer"
                      >
                        <option value="CONSUMO">Consumo</option>
                        <option value="PATRIMONIO">Patrimônio</option>
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-500">
                        <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                          <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
                        </svg>
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Setor / Localização</label>
                    <div className="relative">
                      <select
                        name="localizacaoFisica"
                        defaultValue={editingProduct.localizacaoFisica}
                        className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all appearance-none text-sm cursor-pointer"
                      >
                        <option value="Cozinha">Cozinha</option>
                        <option value="Limpeza">Limpeza</option>
                        <option value="Escritório">Escritório</option>
                        <option value="Sonorização">Sonorização</option>
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-500">
                        <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                          <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
                        </svg>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Quantidade</label>
                    <input
                      name="quantidade"
                      type="number"
                      min="0"
                      defaultValue={editingProduct.quantidade}
                      className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Qtd Mínima (Alerta)</label>
                    <input
                      name="quantidadeMinima"
                      type="number"
                      min="0"
                      defaultValue={editingProduct.quantidadeMinima}
                      className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Descrição</label>
                  <textarea
                    name="descricao"
                    defaultValue={editingProduct.descricao}
                    className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all resize-none text-sm"
                    placeholder="Descrição física ou observações do produto..."
                    rows={3}
                  />
                </div>
              </div>

              <div className="p-6 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  className="px-6 py-2.5 text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
                  onClick={() => setIsEditModalOpen(false)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={navigation.state === "submitting"}
                  className="px-8 py-2.5 bg-blue-500 text-white rounded-xl font-bold text-sm hover:bg-blue-600 shadow-lg shadow-blue-500/30 transition-all transform active:scale-95 disabled:opacity-50"
                >
                  {navigation.state === "submitting" ? "Salvando..." : "Salvar Alterações"}
                </button>
              </div>
            </Form>
          </div>
        </div>
      )}
    </main>
  );
}
