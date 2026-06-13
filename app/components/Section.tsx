/**
 * Componente <Section /> — agrupador de campos com `<fieldset>`/`<legend>` (S02-T05).
 *
 * Agrupa campos relacionados de um formulário em um bloco visual com
 * semântica de **grupo de campos** (fieldset + legend). Útil para forms
 * densos como o `<FormMembro />` (Identificação, Contato, Eclesiástico,
 * Endereço).
 *
 * **Acessibilidade (WCAG 1.3.1 — Info and Relationships):**
 * - `<fieldset>` agrupa controles relacionados.
 * - `<legend>` nomeia o grupo (lido por screen reader como "grupo: <legend>").
 * - O legend é **visível** (não `sr-only`) — funciona como título de seção
 *   do form, o que ajuda na navegação visual.
 *
 * **Visual:**
 * - Container: `border border-slate-200 rounded-lg bg-white p-4 sm:p-6`
 *   (card clean, padding responsivo).
 * - Legend: `text-sm font-semibold text-slate-900 px-2` (com padding
 *   lateral para o legend "flutuar" sobre a borda superior do fieldset).
 *
 * **Tailwind 4 utility-first:** sem `@apply`. Classes via string.
 *
 * @example
 *   <Section title="Identificação">
 *     <Input label="Nome" name="nome" required />
 *     <Select name="tipo" label="Tipo" options={TIPO_OPTIONS} />
 *   </Section>
 *
 * @param props - Props do componente (ver `SectionProps`).
 * @returns Elemento JSX do fieldset.
 */
import type { ReactNode } from "react";

/**
 * Props aceitas pelo `<Section>`.
 */
export type SectionProps = {
  /** Título do grupo de campos (renderizado como `<legend>`). */
  title: string;
  /** Campos/controles do grupo. */
  children: ReactNode;
};

/**
 * @description Fieldset/legend acessível que agrupa campos de formulário.
 * @param {SectionProps} props - Título e children.
 * @returns {JSX.Element} Elemento do fieldset.
 */
export function Section({ title, children }: SectionProps) {
  return (
    <fieldset className="border border-slate-200 rounded-lg p-4 sm:p-6 bg-white space-y-4">
      <legend className="text-sm font-semibold text-slate-900 px-2">
        {title}
      </legend>
      {children}
    </fieldset>
  );
}
