import { Form, useNavigation } from "react-router";
import { useState } from "react";
import { cn } from "~/lib/cn";

/** Membro com cargo (para o select de membros). */
export type MembroCargo = {
  id: string;
  nome: string;
  cargo: string;
};

/** Ministério (para o select de ministérios). */
export type MinisterioItem = {
  id: string;
  nome: string;
};

/** Configuração atual do responsável pelo acolhimento. */
export type ConfigAcolhimento = {
  tipo: "MEMBRO" | "MINISTERIO";
  nome: string;
  /** ID usado como valor inicial do select de responsável. */
  id?: string;
};

/** Props aceitas pelo `<FormConfigAcolhimento>`. */
export type FormConfigAcolhimentoProps = {
  /** Se true, renderiza o formulário. Se false, mostra mensagem de restrição. */
  canEdit: boolean;
  /** Configuração atual (opcional — para preenchimento inicial). */
  config?: ConfigAcolhimento;
  /** Lista de membros com cargo (para o select). */
  membros: MembroCargo[];
  /** Lista de ministérios (para o select). */
  ministerios: MinisterioItem[];
};

/**
 * @description Formulário de configuração do responsável pelo acolhimento com design premium e reatividade.
 * @param {FormConfigAcolhimentoProps} props - canEdit, config, membros, ministerios.
 * @returns {JSX.Element} Elemento JSX.
 */
export function FormConfigAcolhimento({
  canEdit,
  config,
  membros,
  ministerios,
}: FormConfigAcolhimentoProps) {
  const navigation = useNavigation();
  const [selectedTipo, setSelectedTipo] = useState<"MEMBRO" | "MINISTERIO">(
    config?.tipo ?? "MEMBRO"
  );

  if (!canEdit) {
    return (
      <div className="p-6 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-4" data-testid="config-restrito">
        <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center shrink-0">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <div>
          <h4 className="text-base font-bold text-amber-950">Acesso Restrito</h4>
          <p className="text-sm text-amber-700 mt-1">Apenas o Admin pode alterar</p>
        </div>
      </div>
    );
  }

  return (
    <Form method="post" className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
      <input type="hidden" name="intent" value="update" />

      {/* Form Header */}
      <div className="p-6 border-b border-slate-100 bg-slate-50/50">
        <h3 className="text-lg font-bold text-slate-900 font-headline">Alterar Responsável</h3>
        <p className="text-sm text-slate-500">Defina quem receberá alertas automáticos para novos visitantes.</p>
      </div>

      <div className="p-8 space-y-6">
        {/* Radio Cards */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-3">Tipo de responsável</label>
          <div className="grid grid-cols-2 gap-4">
            <label className={cn(
              "relative flex items-center justify-center gap-3 p-4 border rounded-xl cursor-pointer transition-all",
              selectedTipo === "MEMBRO"
                ? "border-blue-500 bg-blue-50 ring-2 ring-blue-500/20"
                : "border-slate-200 hover:bg-slate-50"
            )}>
              <input
                type="radio"
                name="responsavelVisitanteTipo"
                value="MEMBRO"
                checked={selectedTipo === "MEMBRO"}
                onChange={() => setSelectedTipo("MEMBRO")}
                className="sr-only"
              />
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className={cn("h-5 w-5 shrink-0", selectedTipo === "MEMBRO" ? "text-blue-600" : "text-slate-500")}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
              </svg>
              <span className={cn("font-medium text-sm", selectedTipo === "MEMBRO" ? "text-blue-900" : "text-slate-700")}>
                Membro
              </span>
            </label>

            <label className={cn(
              "relative flex items-center justify-center gap-3 p-4 border rounded-xl cursor-pointer transition-all",
              selectedTipo === "MINISTERIO"
                ? "border-indigo-500 bg-indigo-50 ring-2 ring-indigo-500/20"
                : "border-slate-200 hover:bg-slate-50"
            )}>
              <input
                type="radio"
                name="responsavelVisitanteTipo"
                value="MINISTERIO"
                checked={selectedTipo === "MINISTERIO"}
                onChange={() => setSelectedTipo("MINISTERIO")}
                className="sr-only"
              />
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className={cn("h-5 w-5 shrink-0", selectedTipo === "MINISTERIO" ? "text-indigo-600" : "text-slate-500")}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4" />
              </svg>
              <span className={cn("font-medium text-sm", selectedTipo === "MINISTERIO" ? "text-indigo-900" : "text-slate-700")}>
                Ministério
              </span>
            </label>
          </div>
        </div>

        {/* Dropdown Selection */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            {selectedTipo === "MEMBRO" ? "Membro responsável" : "Ministério responsável"}
          </label>
          <div className="relative">
            <select
              name="responsavelId"
              required
              defaultValue={config?.id || ""}
              className="w-full p-2.5 pr-10 border border-slate-200 rounded-xl bg-slate-50 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all appearance-none text-sm cursor-pointer"
            >
              <option value="">
                {selectedTipo === "MEMBRO" ? "Selecione um membro..." : "Selecione um ministério..."}
              </option>
              {selectedTipo === "MEMBRO"
                ? membros.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nome} ({m.cargo})
                    </option>
                  ))
                : ministerios.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nome}
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

        {/* Explanation Card */}
        <div className="p-4 bg-blue-50/50 border border-blue-100 rounded-xl flex items-start gap-3">
          <svg className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-xs text-blue-700 leading-relaxed">
            Ao cadastrar um visitante no sistema, um alerta de boas-vindas e acompanhamento será enviado automaticamente ao responsável configurado acima.
          </p>
        </div>
      </div>

      {/* Form Footer */}
      <div className="p-6 bg-slate-50 border-t border-slate-100 flex items-center justify-end">
        <button
          type="submit"
          disabled={navigation.state === "submitting"}
          className="px-8 py-2.5 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 shadow-lg shadow-blue-500/30 transition-all transform active:scale-95 disabled:opacity-50 cursor-pointer"
        >
          {navigation.state === "submitting" ? "Salvando..." : "Salvar Configuração"}
        </button>
      </div>
    </Form>
  );
}
