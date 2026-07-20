/**
 * Rota /app/financeiro/transferencias — Lista de Transferências entre Caixas.
 *
 * **Backlog S09+:** Listagem de transferências com filtros por período, caixa origem, caixa destino, operador.
 *
 * **Implementação atual (MVP):** Lista básica de transferências.
 */
import { Link, useLoaderData, type LoaderFunctionArgs } from "react-router";
import { userContext } from "~/lib/user-context";
import { assertCanSeeFinancialModule } from "~/lib/rbac.server";
import { prisma } from "~/db/prisma.server";
import { formatBRLFromCents } from "~/lib/money-format";

export function meta() {
  return [{ title: "Transferências — Igreja Conect" }];
}

export async function loader({ context }: LoaderFunctionArgs) {
  const user = context.get(userContext);
  if (!user) {
    throw new Response("Não autenticado.", { status: 401 });
  }

  assertCanSeeFinancialModule(user);

  const transferencias = await prisma.transferenciaCaixa.findMany({
    orderBy: { data: "desc" },
    take: 50,
    include: {
      origem: { select: { id: true, nome: true } },
      destino: { select: { id: true, nome: true } },
      operador: { select: { id: true, nome: true } },
    },
  });

  return { user, transferencias };
}

const formatDate = (date: Date) => {
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const year = date.getUTCFullYear();
  return `${day}/${month}/${year}`;
};

export default function ListaTransferencias() {
  const { user, transferencias } = useLoaderData<typeof loader>();

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Transferências</h1>
          <p className="text-slate-600 mt-1">Histórico de transferências entre caixas.</p>
        </div>
        <Link
          to="/app/financeiro/transferencias/nova"
          className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
        >
          + Nova Transferência
        </Link>
      </div>

      {/* Tabela */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {transferencias.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            Nenhuma transferência encontrada.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Data</th>
                  <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Origem</th>
                  <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Destino</th>
                  <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Valor</th>
                  <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Operador</th>
                  <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Descrição</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {transferencias.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {formatDate(t.dataHora)}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-slate-900">
                      {t.caixaOrigem.nome}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-slate-900">
                      {t.caixaDestino.nome}
                    </td>
                    <td className="px-6 py-4 text-sm font-semibold text-slate-900">
                      {formatBRLFromCents(t.valorCentavos)}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {t.executadoPor.nome}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {t.descricao || "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
