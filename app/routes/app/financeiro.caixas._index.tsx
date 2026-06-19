/**
 * Rota /app/financeiro/caixas — Listagem de Caixas (S06-T11).
 *
 * **Loaders:**
 * - `assertCanSeeFinancialModule(user)` — Camada 2 RBAC.
 * - `listarCaixas({ apenasAtivos, q }, user)` — service layer.
 *
 * **Actions:**
 * - POST com `_action=arquivar` → `arquivarCaixa(id, user)`
 * - POST com `_action=reabrir` → `reabrirCaixa(id, user)`
 *
 * **RBAC:**
 * - Ver dados: ADMIN, PASTOR, FINANCEIRO, SECRETARIO (assertCanSeeFinancialModule).
 * - Arquivar/reabrir: ADMIN, PASTOR, FINANCEIRO (assertCanManageCaixa — validado no service).
 *
 * @see app/lib/caixas.server.ts
 */
import { useEffect, useRef, useState } from "react";
import { Link, useFetcher, useLoaderData, type ActionFunctionArgs, type LoaderFunctionArgs } from "react-router";
import type { Route } from "./+types/financeiro.caixas._index";
import { z } from "zod";
import { userContext } from "~/lib/user-context";
import { assertCanSeeFinancialModule } from "~/lib/rbac.server";
import { listarCaixas, arquivarCaixa, reabrirCaixa } from "~/lib/caixas.server";
import { PageHeader } from "~/components/PageHeader";
import { Can } from "~/components/Can";
import { CaixaSearchBar } from "~/components/CaixaSearchBar";
import { TabelaCaixas } from "~/components/TabelaCaixas";
import { ModalConfirmar } from "~/components/ModalConfirmar";
import { EmptyState } from "~/components/EmptyState";

export function meta(_args: Route.MetaArgs) {
  return [{ title: "Caixas — Financeiro — Igreja Conect" }];
}

/**
 * Loader: valida search params e chama service de listagem.
 */
export async function loader({ request, context }: Route.LoaderArgs) {
  const user = context.get(userContext);
  if (!user) throw new Response("Não autenticado.", { status: 401 });
  assertCanSeeFinancialModule(user);

  const url = new URL(request.url);
  const q = url.searchParams.get("q") ?? undefined;
  const mostrarArquivadosRaw = url.searchParams.get("mostrarArquivados");
  const mostrarArquivados = mostrarArquivadosRaw === "true";

  const result = await listarCaixas(
    { apenasAtivos: !mostrarArquivados, q },
    user
  );

  return { user, q: q ?? "", mostrarArquivados, ...result };
}

/**
 * Action: processa arquivar/reabrir via fetcher.
 */
export async function action({ request, context }: Route.ActionArgs) {
  const user = context.get(userContext);
  if (!user) throw new Response("Não autenticado.", { status: 401 });
  assertCanSeeFinancialModule(user);

  const formData = await request.formData();
  const _action = formData.get("_action")?.toString();
  const caixaId = formData.get("caixaId")?.toString();

  if (!caixaId) {
    return { ok: false, error: "caixaId é obrigatório." };
  }

  try {
    if (_action === "arquivar") {
      await arquivarCaixa(caixaId, user);
      return { ok: true };
    }
    if (_action === "reabrir") {
      await reabrirCaixa(caixaId, user);
      return { ok: true };
    }
    return { ok: false, error: "Ação inválida." };
  } catch (e) {
    if (e instanceof Response) {
      const text = await e.text().catch(() => "Erro ao processar ação.");
      return { ok: false, error: text };
    }
    return { ok: false, error: "Erro interno." };
  }
}

/**
 * Página de listagem de caixas.
 */
export default function CaixasList() {
  const { user, q, mostrarArquivados, ativos, arquivados } =
    useLoaderData<typeof loader>();

  const podeGerenciar =
    user.cargo != null &&
    ["ADMIN", "PASTOR", "FINANCEIRO"].includes(user.cargo);

  // Estado do modal de confirmação
  const [modalOpen, setModalOpen] = useState(false);
  const [modalAction, setModalAction] = useState<"arquivar" | "reabrir" | null>(null);
  const [modalCaixaId, setModalCaixaId] = useState<string | null>(null);
  const [modalNome, setModalNome] = useState<string>("");

  const fetcher = useFetcher();
  const formRef = useRef<HTMLFormElement>(null);

  // Fecha modal após sucesso
  useEffect(() => {
    if (fetcher.data && fetcher.state === "idle") {
      setModalOpen(false);
    }
  }, [fetcher.data, fetcher.state]);

  const abrirModal = (action: "arquivar" | "reabrir", id: string, nome: string) => {
    setModalAction(action);
    setModalCaixaId(id);
    setModalNome(nome);
    setModalOpen(true);
  };

  const confirmar = () => {
    if (!modalAction || !modalCaixaId) return;
    fetcher.submit(
      { _action: modalAction, caixaId: modalCaixaId },
      { method: "post" }
    );
  };

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <PageHeader
        title="Caixas"
        action={
          <Can user={user} allow={["ADMIN", "PASTOR", "FINANCEIRO"]}>
            <Link
              to="/app/financeiro/caixas/novo"
              className="inline-flex items-center justify-center rounded-md bg-cyan-700 px-3 h-9 text-sm font-medium text-white hover:bg-cyan-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-700 focus-visible:ring-offset-2"
            >
              + Nova Caixa
            </Link>
          </Can>
        }
      />

      <CaixaSearchBar q={q} mostrarArquivados={mostrarArquivados} />

      {/* Caixas ativos */}
      {ativos.length > 0 && (
        <section className="mb-6">
          <h2 className="text-base font-semibold text-slate-900 mb-2">
            Caixas Ativos ({ativos.length})
          </h2>
          <TabelaCaixas
            items={ativos}
            podeGerenciar={podeGerenciar}
            onArquivar={(id) => {
              const caixa = ativos.find((c) => c.id === id);
              if (caixa) abrirModal("arquivar", id, caixa.nome);
            }}
          />
        </section>
      )}

      {/* Caixas arquivados (toggle) */}
      {mostrarArquivados && arquivados.length > 0 && (
        <section className="mb-6">
          <h2 className="text-base font-semibold text-slate-900 mb-2">
            Caixas Arquivados ({arquivados.length})
          </h2>
          <TabelaCaixas
            items={arquivados}
            podeGerenciar={podeGerenciar}
            onReabrir={(id) => {
              const caixa = arquivados.find((c) => c.id === id);
              if (caixa) abrirModal("reabrir", id, caixa.nome);
            }}
          />
        </section>
      )}

      {/* Empty state */}
      {ativos.length === 0 && (!mostrarArquivados || arquivados.length === 0) && (
        <EmptyState
          title="Nenhum caixa encontrado"
          description="Crie um novo caixa para organizar as finanças da igreja."
          action={
            podeGerenciar
              ? { label: "Criar Caixa", to: "/app/financeiro/caixas/novo" }
              : undefined
          }
        />
      )}

      {/* Modal de confirmação */}
      <ModalConfirmar
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onConfirm={confirmar}
        title={
          modalAction === "arquivar" ? "Arquivar Caixa" : "Reabrir Caixa"
        }
        description={
          modalAction === "arquivar"
            ? `Tem certeza que deseja arquivar "${modalNome}"? O saldo será preservado, mas não será possível fazer novos lançamentos.`
            : `Tem certeza que deseja reabrir "${modalNome}"? O caixa voltará a aceitar lançamentos.`
        }
        confirmLabel={modalAction === "arquivar" ? "Arquivar" : "Reabrir"}
        variant={modalAction === "arquivar" ? "danger" : "primary"}
      />
    </div>
  );
}
