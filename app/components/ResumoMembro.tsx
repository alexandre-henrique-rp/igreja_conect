/**
 * Componente <ResumoMembro /> — card de resumo (S03-T07).
 *
 * Renderiza o resumo do membro no topo da página de detalhe:
 * 1. **h1** com nome do membro.
 * 2. **Badge de tipo** (VISITANTE / CONGREGADO / MEMBRO_ATIVO).
 * 3. **Bloco de contato** (email + telefone).
 * 4. **Bloco de endereço** (logradouro, número, bairro, cidade, estado, CEP).
 *
 * **Diferença para `TabDadosPessoais`:** o Resumo é **sempre visível**
 * (acima das abas), enquanto a Tab Dados só aparece quando o usuário
 * clica na aba "Dados". Reduz redundância — só os dados principais
 * ficam no Resumo; campos eclesiásticos ficam na Tab.
 *
 * **LGPD:** exibe email/telefone porque o usuário já tem acesso ao
 * detalhe (escopo RBAC aplicado no loader). O nome aparece 1×
 * (no h1) — sem repetições para screen reader.
 *
 * @example
 *   <ResumoMembro membro={membro} />
 *
 * @param props - Props do componente.
 * @returns Elemento JSX do card de resumo.
 */

/**
 * Tipo do membro aceito por `<ResumoMembro>`.
 */
export type ResumoMembroData = {
  id: string;
  nome: string;
  tipo: "VISITANTE" | "CONGREGADO" | "MEMBRO_ATIVO";
  email: string | null;
  telefone: string | null;
  logradouro?: string | null;
  numero?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  estado?: string | null;
  cep?: string | null;
  cargo?: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
};

/**
 * Props aceitas pelo `<ResumoMembro>`.
 */
export type ResumoMembroProps = {
  /** Membro foco. */
  membro: ResumoMembroData;
};

/** Labels e classes do tipo. */
const TIPO_LABEL: Record<ResumoMembroData["tipo"], string> = {
  VISITANTE: "Visitante",
  CONGREGADO: "Congregado",
  MEMBRO_ATIVO: "Membro ativo",
};
const TIPO_CLASS: Record<ResumoMembroData["tipo"], string> = {
  VISITANTE: "bg-amber-100 text-amber-800",
  CONGREGADO: "bg-blue-100 text-blue-800",
  MEMBRO_ATIVO: "bg-green-100 text-green-800",
};

/**
 * @description Card de resumo do membro (nome, tipo, contato, endereço).
 * @param {ResumoMembroProps} props - membro.
 * @returns {JSX.Element} Elemento JSX do card.
 */
export function ResumoMembro({ membro }: ResumoMembroProps) {
  const hasAddress = Boolean(
    membro.logradouro || membro.cidade || membro.bairro
  );

  return (
    <section
      className="border border-slate-200 rounded-lg bg-white p-4 sm:p-6"
      data-testid="resumo-membro"
    >
      {/* Header: nome + tipo */}
      <header className="flex items-center gap-2 flex-wrap mb-3">
        <h1 className="text-2xl font-bold text-slate-900">{membro.nome}</h1>
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${TIPO_CLASS[membro.tipo]}`}
        >
          {TIPO_LABEL[membro.tipo]}
        </span>
      </header>

      {/* Contato */}
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm mb-3">
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-500">
            E-mail
          </dt>
          <dd className="text-slate-900 mt-0.5">{membro.email ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-500">
            Telefone
          </dt>
          <dd className="text-slate-900 mt-0.5">{membro.telefone ?? "—"}</dd>
        </div>
      </dl>

      {/* Endereço */}
      <div>
        <h2 className="text-sm font-semibold text-slate-900 mb-1">Endereço</h2>
        {hasAddress ? (
          <p className="text-sm text-slate-700">
            {[
              membro.logradouro,
              membro.numero ? `nº ${membro.numero}` : null,
              membro.bairro,
              membro.cidade,
              membro.estado,
            ]
              .filter(Boolean)
              .join(", ")}
            {membro.cep ? ` — CEP ${membro.cep}` : ""}
          </p>
        ) : (
          <p className="text-sm text-slate-500">Endereço não informado.</p>
        )}
      </div>
    </section>
  );
}
