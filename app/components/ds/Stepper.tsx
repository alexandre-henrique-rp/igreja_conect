/**
 * <Stepper /> — indicador de progresso multi-etapas (formulário wizard).
 *
 * @example
 *   <Stepper steps={[
 *     { label: "Dados" },
 *     { label: "Endereço", active: true },
 *     { label: "Confirmar", done: true },
 *   ]} />
 */
import { cn } from "~/lib/cn";

export type StepperStep = {
  label: string;
  active?: boolean;
  done?: boolean;
};

export type StepperProps = {
  steps: StepperStep[];
  className?: string;
};

export function Stepper({ steps, className }: StepperProps) {
  return (
    <ol
      className={cn(
        "flex items-center max-w-2xl mb-6",
        className,
      )}
      aria-label="Progresso do formulário"
    >
      {steps.map((s, i) => {
        const isLast = i === steps.length - 1;
        const state: "active" | "done" | "todo" = s.active
          ? "active"
          : s.done
            ? "done"
            : "todo";
        return (
          <li
            key={s.label}
            className={cn(
              "flex items-center gap-2 text-xs font-bold whitespace-nowrap",
              state === "active" && "text-accent-strong",
              state === "done" && "text-success",
              state === "todo" && "text-subtle",
            )}
          >
            <span
              className={cn(
                "grid place-items-center h-[26px] w-[26px] rounded-full border text-[11px]",
                state === "active" &&
                  "bg-accent text-white border-accent",
                state === "done" &&
                  "bg-success-soft text-success border-success-soft",
                state === "todo" && "border-border-strong text-subtle",
              )}
              aria-current={state === "active" ? "step" : undefined}
            >
              {state === "done" ? "✓" : i + 1}
            </span>
            <span>{s.label}</span>
            {!isLast && (
              <span className="h-px flex-1 mx-3 bg-border-strong min-w-[24px]" />
            )}
          </li>
        );
      })}
    </ol>
  );
}
