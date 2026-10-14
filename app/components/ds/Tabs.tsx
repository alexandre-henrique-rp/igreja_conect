/**
 * <Tabs /> + <TabList /> + <Tab /> + <TabPanel /> — abas acessíveis.
 *
 * Tabs **controladas** — caller gerencia `value`/`onChange`.
 *
 * @example
 *   const [tab, setTab] = useState("dados");
 *   <Tabs value={tab} onValueChange={setTab}>
 *     <TabList items={[{value:"dados",label:"Dados"},{value:"hist",label:"Histórico"}]} />
 *     {tab === "dados" && <TabPanel value="dados">...</TabPanel>}
 *   </Tabs>
 */
import {
  createContext,
  useContext,
  type ReactNode,
} from "react";
import { cn } from "~/lib/cn";

type TabsContextValue = {
  value: string;
  onValueChange: (next: string) => void;
};

const TabsContext = createContext<TabsContextValue | null>(null);

function useTabs() {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error("Tab* deve estar dentro de <Tabs>");
  return ctx;
}

export type TabsProps = {
  value: string;
  onValueChange: (next: string) => void;
  children: ReactNode;
  className?: string;
};

export function Tabs({ value, onValueChange, children, className }: TabsProps) {
  return (
    <TabsContext.Provider value={{ value, onValueChange }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
}

export type TabListItem = {
  value: string;
  label: ReactNode;
  disabled?: boolean;
};

export function TabList({
  items,
  className,
}: {
  items: TabListItem[];
  className?: string;
}) {
  const { value, onValueChange } = useTabs();
  return (
    <div
      role="tablist"
      className={cn(
        "flex gap-6 overflow-x-auto border-b border-border",
        className,
      )}
    >
      {items.map((it) => {
        const active = it.value === value;
        return (
          <button
            key={it.value}
            type="button"
            role="tab"
            aria-selected={active}
            aria-controls={`tabpanel-${it.value}`}
            id={`tab-${it.value}`}
            tabIndex={active ? 0 : -1}
            disabled={it.disabled}
            onClick={() => onValueChange(it.value)}
            className={cn(
              "relative min-h-11 px-0.5 bg-transparent text-xs font-bold whitespace-nowrap",
              "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg rounded-sm",
              "after:absolute after:left-0 after:right-0 after:bottom-[-1px] after:h-0.5 after:bg-transparent after:transition-colors",
              active && "text-accent-strong after:bg-accent",
              !active && "text-muted hover:text-fg",
              it.disabled && "opacity-50 cursor-not-allowed",
            )}
          >
            {it.label}
          </button>
        );
      })}
    </div>
  );
}

export function TabPanel({
  value,
  children,
  className,
}: {
  value: string;
  children: ReactNode;
  className?: string;
}) {
  const { value: active } = useTabs();
  if (active !== value) return null;
  return (
    <div
      role="tabpanel"
      id={`tabpanel-${value}`}
      aria-labelledby={`tab-${value}`}
      className={cn("pt-4", className)}
    >
      {children}
    </div>
  );
}
