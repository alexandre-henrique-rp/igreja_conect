/**
 * Componente <FormMembro /> — formulário de criar/editar membro (S02-T05).
 *
 * Formulário completo de membro, usado em:
 * - `/app/membros/novo` → `isEdit={false}`.
 * - `/app/membros/:id/editar` → `isEdit={true}`.
 *
 * **Estrutura (4 sections via `<Section />`):**
 * 1. **Identificação:** nome (obrigatório) + tipo (enum).
 * 2. **Contato:** email + telefone (com máscara `(XX) XXXXX-XXXX`).
 * 3. **Eclesiástico:** data conversão + data batismo + profissão + estado civil.
 * 4. **Endereço:** CEP (com máscara `XXXXX-XXX`) + logradouro + número + bairro + cidade + estado.
 *
 * **Máscaras client-side (sem lib externa):** useState local com regex
 * (ver `~/lib/masks.ts`). Não bloqueiam backspace — basta apagar e a
 * máscara reaplica no que sobrou.
 *
 * **Validação:** client-side **não** — confiamos no `<form noValidate>` +
 * revalidação Zod no action server-side. `fieldErrors` recebido via props
 * é renderizado inline.
 *
 * **Loading state:** botão submit com `loading={navigation.state === "submitting"}`.
 * Quando true, mostra spinner e desabilita cliques (via `<Button loading>`).
 *
 * **Acessibilidade:**
 * - Labels associados em todos os campos (via `<Input>`/`<Select>`).
 * - `aria-describedby` para hints e erros (via `<Input>`).
 * - Submit com `aria-busy` durante loading.
 *
 * **LGPD (RN-MEM-02):** este form **NÃO** tem campo CPF/RG/CNPJ. Grep
 * `cpf|rg|cnpj` retorna 0 — verificável no CI (ver RAG `lgpd-igreja-conect`).
 *
 * @example
 *   // Em app/routes/app/membros.novo.tsx
 *   return (
 *     <FormMembro
 *       isEdit={false}
 *       formError={actionData?.formError}
 *       fieldErrors={actionData?.fieldErrors}
 *     />
 *   );
 *
 * @param props - Props do componente (ver `FormMembroProps`).
 * @returns Elemento JSX do formulário.
 */
import { useState } from "react";
import { Form, Link, useNavigation } from "react-router";
import { Button } from "./Button";
import { ErrorAlert } from "./ErrorAlert";
import { Input } from "./Input";
import { Section } from "./Section";
import { Select } from "./Select";
import { mascaraCep, mascaraTelefone } from "~/lib/masks";

/**
 * Tipo de membro (espelha o enum `TipoMembro` do Prisma).
 */
export type TipoMembroValue = "VISITANTE" | "CONGREGADO" | "MEMBRO_ATIVO";

/**
 * Default values do form. Vindos do loader (em edição) ou vazios (em criar).
 * Todos opcionais — `defaultValues` aceita subset.
 */
export type FormMembroDefaultValues = {
  /** ID do membro (presente apenas em edição). */
  id?: string;
  nome?: string;
  tipo?: TipoMembroValue;
  email?: string;
  telefone?: string;
  dataConversao?: string;
  dataBatismo?: string;
  profissao?: string;
  estadoCivil?: string;
  cep?: string;
  logradouro?: string;
  numero?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
};

/**
 * Props aceitas pelo `<FormMembro>`.
 */
export type FormMembroProps = {
  /** `true` quando é tela de edição; muda label do submit e link do Cancelar. */
  isEdit: boolean;
  /** Valores iniciais (loader de edição) ou undefined (criar). */
  defaultValues?: FormMembroDefaultValues;
  /** Erro geral do action (acima do form). */
  formError?: string;
  /** Erros por campo do action (vindos de Zod safeParse ou EmailDuplicadoError). */
  fieldErrors?: Record<string, string[] | undefined>;
};

/** Opções fixas de tipo (não vem do banco — é enum do Prisma). */
const TIPO_OPTIONS = [
  { value: "VISITANTE", label: "Visitante" },
  { value: "CONGREGADO", label: "Congregado" },
  { value: "MEMBRO_ATIVO", label: "Membro ativo" },
];

/** Lista de UFs (26 estados + DF) — para o select de Estado. */
const UF_OPTIONS = [
  { value: "AC", label: "AC" },
  { value: "AL", label: "AL" },
  { value: "AP", label: "AP" },
  { value: "AM", label: "AM" },
  { value: "BA", label: "BA" },
  { value: "CE", label: "CE" },
  { value: "DF", label: "DF" },
  { value: "ES", label: "ES" },
  { value: "GO", label: "GO" },
  { value: "MA", label: "MA" },
  { value: "MT", label: "MT" },
  { value: "MS", label: "MS" },
  { value: "MG", label: "MG" },
  { value: "PA", label: "PA" },
  { value: "PB", label: "PB" },
  { value: "PR", label: "PR" },
  { value: "PE", label: "PE" },
  { value: "PI", label: "PI" },
  { value: "RJ", label: "RJ" },
  { value: "RN", label: "RN" },
  { value: "RS", label: "RS" },
  { value: "RO", label: "RO" },
  { value: "RR", label: "RR" },
  { value: "SC", label: "SC" },
  { value: "SP", label: "SP" },
  { value: "SE", label: "SE" },
  { value: "TO", label: "TO" },
];

/**
 * @description Formulário de membro (criar/editar) com 4 sections e máscaras client-side.
 * @param {FormMembroProps} props - isEdit, defaultValues, formError, fieldErrors.
 * @returns {JSX.Element} Elemento do formulário.
 */
export function FormMembro({
  isEdit,
  defaultValues,
  formError,
  fieldErrors,
}: FormMembroProps) {
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  // Estado local para os campos com máscara. Inicializa com a versão
  // já formatada (vinda de `defaultValues`) — quando o usuário edita,
  // a máscara é reaplicada.
  const [telefone, setTelefone] = useState(defaultValues?.telefone ?? "");
  const [cep, setCep] = useState(defaultValues?.cep ?? "");

  // Link do Cancelar — edição volta para o detalhe, criar volta para a lista.
  const cancelarHref = isEdit
    ? `/app/membros/${defaultValues?.id ?? ""}`
    : "/app/membros";

  return (
    <Form method="post" noValidate className="space-y-6">
      {formError && (
        <ErrorAlert tone="error">{formError}</ErrorAlert>
      )}

      {/* Identificação */}
      <Section title="Identificação">
        <Input
          id="nome"
          name="nome"
          label="Nome completo"
          required
          maxLength={120}
          defaultValue={defaultValues?.nome}
          error={fieldErrors?.nome?.[0]}
          hint="Mínimo 2 caracteres."
        />
        <Select
          name="tipo"
          id="tipo"
          label="Tipo"
          defaultValue={defaultValues?.tipo ?? "VISITANTE"}
          options={TIPO_OPTIONS}
        />
      </Section>

      {/* Contato */}
      <Section title="Contato">
        <Input
          id="email"
          name="email"
          type="email"
          label="E-mail"
          autoComplete="email"
          inputMode="email"
          maxLength={200}
          defaultValue={defaultValues?.email}
          error={fieldErrors?.email?.[0]}
        />
        <Input
          id="telefone"
          name="telefone"
          type="tel"
          label="Telefone"
          autoComplete="tel"
          inputMode="tel"
          maxLength={16}
          value={telefone}
          onChange={(e) => setTelefone(mascaraTelefone(e.target.value))}
          error={fieldErrors?.telefone?.[0]}
          hint="Opcional. Aceita fixo (10 dígitos) ou celular (11 dígitos)."
        />
      </Section>

      {/* Eclesiástico */}
      <Section title="Eclesiástico">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            id="dataConversao"
            name="dataConversao"
            type="date"
            label="Data de conversão"
            defaultValue={defaultValues?.dataConversao}
            error={fieldErrors?.dataConversao?.[0]}
          />
          <Input
            id="dataBatismo"
            name="dataBatismo"
            type="date"
            label="Data de batismo"
            defaultValue={defaultValues?.dataBatismo}
            error={fieldErrors?.dataBatismo?.[0]}
            hint="Deve ser igual ou posterior à data de conversão."
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            id="profissao"
            name="profissao"
            label="Profissão"
            maxLength={80}
            defaultValue={defaultValues?.profissao}
            error={fieldErrors?.profissao?.[0]}
            hint="Opcional."
          />
          <Input
            id="estadoCivil"
            name="estadoCivil"
            label="Estado civil"
            maxLength={40}
            defaultValue={defaultValues?.estadoCivil}
            error={fieldErrors?.estadoCivil?.[0]}
            hint="Opcional."
          />
        </div>
      </Section>

      {/* Endereço */}
      <Section title="Endereço">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Input
            id="cep"
            name="cep"
            label="CEP"
            inputMode="numeric"
            maxLength={9}
            value={cep}
            onChange={(e) => setCep(mascaraCep(e.target.value))}
            defaultValue={defaultValues?.cep}
            error={fieldErrors?.cep?.[0]}
            hint="Opcional."
          />
          <div className="sm:col-span-2">
            <Input
              id="logradouro"
              name="logradouro"
              label="Logradouro"
              maxLength={120}
              defaultValue={defaultValues?.logradouro}
              error={fieldErrors?.logradouro?.[0]}
            />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Input
            id="numero"
            name="numero"
            label="Número"
            inputMode="numeric"
            maxLength={20}
            defaultValue={defaultValues?.numero}
            error={fieldErrors?.numero?.[0]}
          />
          <div className="sm:col-span-2">
            <Input
              id="bairro"
              name="bairro"
              label="Bairro"
              maxLength={80}
              defaultValue={defaultValues?.bairro}
              error={fieldErrors?.bairro?.[0]}
            />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-2">
            <Input
              id="cidade"
              name="cidade"
              label="Cidade"
              maxLength={80}
              defaultValue={defaultValues?.cidade}
              error={fieldErrors?.cidade?.[0]}
            />
          </div>
          <Select
            name="estado"
            id="estado"
            label="Estado (UF)"
            defaultValue={defaultValues?.estado ?? ""}
            options={UF_OPTIONS}
            placeholder="Selecione…"
          />
        </div>
      </Section>

      {/* Ações */}
      <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
        <Button as={Link} to={cancelarHref} variant="ghost">
          Cancelar
        </Button>
        <Button
          type="submit"
          variant="primary"
          loading={isSubmitting}
        >
          {isEdit ? "Salvar alterações" : "Cadastrar membro"}
        </Button>
      </div>
    </Form>
  );
}
