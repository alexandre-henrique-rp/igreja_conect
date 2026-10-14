import { useState } from "react";
import { Form } from "react-router";
import { Button } from "~/components/ds";

type Funcao = {
  id: string;
  nome: string;
  cor: string | null;
};

type Props = {
  ministerioId: string;
  funcoes: Funcao[];
  canEdit: boolean;
};

const PALETTE = ["#3B82F6", "#8B5CF6", "#EC4899", "#EF4444", "#F59E0B", "#10B981", "#06B6D4", "#6366F1"];

export function GerenciarFuncoes({ ministerioId, funcoes, canEdit }: Props) {
  const [novaFuncao, setNovaFuncao] = useState("");
  const [corSelecionada, setCorSelecionada] = useState(PALETTE[0]);

  return (
    <div className="bg-surface border border-border rounded-2xl shadow-xs overflow-hidden">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-surface-2">
        <div className="p-2 rounded-xl bg-accent-soft-2 text-accent flex items-center justify-center">
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
          </svg>
        </div>
        <h2 className="text-base font-extrabold text-fg">Funções do Ministério</h2>
      </div>

      {/* Texto explicativo ponto-a-ponto */}
      <div className="px-6 pt-4">
        <ul className="space-y-1 text-xs text-muted">
          <li><strong>O que são funções:</strong> cada ministério tem suas próprias funções (ex: Louvor → vocal, guitarrista, baterista; Recepção → recepcionista, anfitrião).</li>
          <li><strong>Como cadastrar:</strong> digite o nome da função e escolha uma cor de identificação. Clique em "Adicionar".</li>
          <li><strong>Vincular ao membro:</strong> na tabela de membros abaixo, use o select "Função" para atribuir cada membro a uma função.</li>
          <li><strong>Uso na geração de escalas:</strong> o sistema usa as funções cadastradas para sortear membros automaticamente — cada função recebe um membro disponível por culto/ensaio.</li>
        </ul>
      </div>

      <div className="px-6 py-4">
        {/* Lista de funções */}
        {funcoes.length === 0 ? (
          <p className="text-sm text-subtle mb-4">Nenhuma função cadastrada ainda.</p>
        ) : (
          <div className="flex flex-wrap gap-2 mb-4">
            {funcoes.map((f) => (
              <div
                key={f.id}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border"
                style={{
                  backgroundColor: (f.cor ?? "#3B82F6") + "15",
                  borderColor: (f.cor ?? "#3B82F6") + "40",
                  color: f.cor ?? "#3B82F6",
                }}
              >
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: f.cor ?? "#3B82F6" }} />
                {f.nome}
                {canEdit && (
                  <Form method="post" className="inline">
                    <input type="hidden" name="intent" value="remove-funcao" />
                    <input type="hidden" name="funcaoId" value={f.id} />
                    <button
                      type="submit"
                      className="ml-1 text-subtle hover:text-danger"
                      aria-label={`Remover função ${f.nome}`}
                    >
                      <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </Form>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Form adicionar função */}
        {canEdit && (
          <Form method="post" className="flex items-end gap-3">
            <input type="hidden" name="intent" value="add-funcao" />
            <div className="flex-1 space-y-1">
              <label htmlFor="novaFuncao" className="block text-xs font-medium text-muted">
                Nova função
              </label>
              <input
                id="novaFuncao"
                name="nome"
                type="text"
                placeholder="Ex: Vocal, Guitarrista, Baterista..."
                value={novaFuncao}
                onChange={(e) => setNovaFuncao(e.target.value)}
                className="w-full h-9 px-3 border border-border-strong rounded-md text-sm text-fg placeholder:text-subtle focus:outline-none focus:ring-2 focus:ring-accent"
                required
              />
            </div>
            <div className="flex items-center gap-1.5">
              {PALETTE.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCorSelecionada(c)}
                  className={`w-6 h-6 rounded-full border-2 transition-transform ${corSelecionada === c ? "scale-125 border-fg" : "border-transparent"}`}
                  style={{ backgroundColor: c }}
                  aria-label={`Cor ${c}`}
                />
              ))}
            </div>
            <input type="hidden" name="cor" value={corSelecionada} />
            <Button type="submit" size="sm" disabled={!novaFuncao.trim()}>
              Adicionar
            </Button>
          </Form>
        )}
      </div>
    </div>
  );
}
