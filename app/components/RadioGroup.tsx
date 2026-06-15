/**
 * Componente <RadioGroup /> — radio group acessível (S03-T09).
 *
 * Wrapper leve sobre radios nativos com `<fieldset>` + `<legend>`
 * para agrupar opções mutuamente exclusivas. **Acessibilidade
 * WCAG 1.3.1** — a associação fieldset/legend é o padrão recomendado
 * para radio groups em HTML semântico.
 *
 * **Diferença para `<Radio>` único:** este é para 2+ opções. Use
 * `<input type="radio">` solto quando já está dentro de outro
 * `<fieldset>`.
 *
 * **Visual:** spacing confortável entre opções, focus visível com
 * ring-2 cyan-700 (alinhado ao design system).
 *
 * @example
 *   <RadioGroup
 *     name="filtro"
 *     legend="Filtrar por"
 *     defaultValue="ativos"
 *     onChange={(v) => setFiltro(v)}
 *     options={[
 *       { value: "ativos", label: "Membros ativos" },
 *       { value: "todos", label: "Todos" },
 *     ]}
 *   />
 *
 * @param props - Props do componente.
 * @returns Elemento JSX do radio group.
 */

/**
 * Opção do `<RadioGroup>`.
 */
export type RadioOption = {
  /** Valor submetido no FormData. */
  value: string;
  /** Texto exibido. */
  label: string;
};

/**
 * Props aceitas pelo `<RadioGroup>`.
 */
export type RadioGroupProps = {
  /** `name` compartilhado por todos os radios. */
  name: string;
  /** Texto do `<legend>` (sempre visível). */
  legend: string;
  /** Lista de opções. */
  options: RadioOption[];
  /** Valor inicial selecionado (opcional). */
  defaultValue?: string;
  /** Valor controlado (opcional). */
  value?: string;
  /** Callback quando o usuário muda a seleção. */
  onChange?: (value: string) => void;
  /** Classes extras no fieldset. */
  className?: string;
};

/**
 * @description Radio group acessível com fieldset/legend e options.
 * @param {RadioGroupProps} props - name, legend, options, defaultValue, onChange.
 * @returns {JSX.Element} Elemento JSX do fieldset.
 */
export function RadioGroup({
  name,
  legend,
  options,
  defaultValue,
  value,
  onChange,
  className,
}: RadioGroupProps) {
  return (
    <fieldset className={className}>
      <legend className="text-sm font-medium text-slate-700 mb-1">
        {legend}
      </legend>
      <div className="space-y-1">
        {options.map((o) => {
          // Controlado vs não-controlado.
          const isChecked =
            value !== undefined ? value === o.value : defaultValue === o.value;
          return (
            <label
              key={o.value}
              className="flex items-center gap-2 cursor-pointer select-none"
            >
              <input
                type="radio"
                name={name}
                value={o.value}
                defaultChecked={value === undefined ? defaultValue === o.value : undefined}
                checked={value !== undefined ? isChecked : undefined}
                onChange={() => onChange?.(o.value)}
                className="text-cyan-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-700 focus-visible:ring-offset-2"
              />
              <span className="text-sm text-slate-700">{o.label}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
