/**
 * Componente <FormConfigAcolhimento /> — formulário de config. de acolhimento (S04-T05).
 *
 * Permite ao ADMIN configurar o responsável (membro ou ministério) que
 * receberá alertas quando um visitante for cadastrado.
 *
 * **Comportamento:**
 * - `canEdit=false`: mostra `<InfoBox>` informando que apenas Admin pode alterar.
 * - `canEdit=true`: renderiza `<form method="post">` com:
 *   - RadioGroup (MEMBRO/MINISTERIO) controlando qual Select aparece.
 *   - Select de membros (apenas com cargo) ou select de ministérios.
 *   - Campos `responsavelVisitanteTipo` e `responsavelId` no FormData.
 *   - `<input type="hidden" name="intent" value="update">`.
 *   - `<InfoBox>` explicativo ao final.
 *
 * @example
 *   <FormConfigAcolhimento
 *     canEdit={user.cargo === "ADMIN"}
 *     config={{ tipo: "MEMBRO", nome: "João" }}
 *     membros={membrosComCargo}
 *     ministerios={ministerios}
 *   />
 *
 * @param props - Props do componente.
 * @param props.canEdit - Se true, renderiza o form; senão, mostra mensagem.
 * @param props.config - Configuração atual (para pré-selecionar radio/select).
 * @param props.membros - Lista de membros com cargo para o select.
 * @param props.ministerios - Lista de ministérios para o select.
 * @returns Elemento JSX do formulário ou info box.
 */
import { Form } from "react-router";
import { InfoBox } from "./InfoBox";
import { RadioGroup } from "./RadioGroup";
import { Select } from "./Select";

/**
 * Membro com cargo (para o select de membros).
 */
export type MembroCargo = {
  id: string;
  nome: string;
  cargo: string;
};

/**
 * Ministério (para o select de ministérios).
 */
export type MinisterioItem = {
  id: string;
  nome: string;
};

/**
 * Configuração atual do responsável pelo acolhimento.
 */
export type ConfigAcolhimento = {
  tipo: "MEMBRO" | "MINISTERIO";
  nome: string;
  /** ID usado como valor inicial do select de responsável. */
  id?: string;
};

/**
 * Props aceitas pelo `<FormConfigAcolhimento>`.
 */
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

/** Opções fixas do RadioGroup de tipo. */
const TIPO_OPTIONS = [
  { value: "MEMBRO", label: "Membro" },
  { value: "MINISTERIO", label: "Ministério" },
];

/**
 * @description Formulário de configuração do responsável pelo acolhimento.
 * @param {FormConfigAcolhimentoProps} props - canEdit, config, membros, ministerios.
 * @returns {JSX.Element} Elemento JSX.
 */
export function FormConfigAcolhimento({
  canEdit,
  config,
  membros,
  ministerios,
}: FormConfigAcolhimentoProps) {
  if (!canEdit) {
    return (
      <InfoBox tone="warning" title="Acesso restrito">
        Apenas o Admin pode alterar
      </InfoBox>
    );
  }

  const selectedTipo = config?.tipo ?? "MEMBRO";

  return (
    <Form method="post" className="space-y-4">
      <input type="hidden" name="intent" value="update" />

      <RadioGroup
        name="responsavelVisitanteTipo"
        legend="Tipo de responsável"
        defaultValue={selectedTipo}
        options={TIPO_OPTIONS}
      />

      {selectedTipo === "MEMBRO" ? (
        <Select
          name="responsavelId"
          label="Membro responsável"
          placeholder="Selecione um membro…"
          defaultValue={config?.tipo === "MEMBRO" ? config.id : undefined}
          options={membros.map((m) => ({
            value: m.id,
            label: `${m.nome} (${m.cargo})`,
          }))}
        />
      ) : (
        <Select
          name="responsavelId"
          label="Ministério responsável"
          placeholder="Selecione um ministério…"
          defaultValue={config?.tipo === "MINISTERIO" ? config.id : undefined}
          options={ministerios.map((m) => ({
            value: m.id,
            label: m.nome,
          }))}
        />
      )}

      <InfoBox>
        Ao cadastrar um visitante, um alerta será enviado ao responsável
        configurado
      </InfoBox>

      <div className="flex justify-end">
        <button
          type="submit"
          className="inline-flex items-center justify-center rounded-md bg-cyan-700 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-700 focus-visible:ring-offset-2"
        >
          Salvar
        </button>
      </div>
    </Form>
  );
}
