import { useState, useRef, useEffect, useCallback } from "react";
import type { InputHTMLAttributes, ReactNode } from "react";
import { useFetcher } from "react-router";
import { cn } from "~/lib/cn";

type SearchResult = {
  id: string;
  label: string;
  sublabel?: string;
};

type AutocompleteInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "id" | "onChange"
> & {
  label: ReactNode;
  name: string;
  id?: string;
  hint?: string;
  error?: string;
  leadingIcon?: ReactNode;
  required?: boolean;
  variant?: "default" | "dark";
  hideAsterisk?: boolean;
  /** Tipo de busca: "celulas" ou "members" */
  searchType: "celulas" | "members";
  /** Valor inicial do input */
  defaultValue?: string;
  /** Callback quando um item é selecionado */
  onSelect?: (item: SearchResult) => void;
};

export function AutocompleteInput({
  label,
  name,
  id,
  hint,
  error,
  leadingIcon,
  required,
  variant = "default",
  hideAsterisk = false,
  searchType,
  defaultValue = "",
  onSelect,
  ...rest
}: AutocompleteInputProps) {
  const inputId = id ?? name;
  const descId = `${inputId}-desc`;
  const hasError = Boolean(error);
  const isDark = variant === "dark";

  const [value, setValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const fetcher = useFetcher<{ results?: SearchResult[]; error?: string }>();

  const results = fetcher.data?.results ?? [];
  const showDropdown = open && (results.length > 0 || fetcher.state === "loading");

  const doSearch = useCallback(
    (q: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        const params = new URLSearchParams();
        params.set("type", searchType);
        params.set("q", q);
        fetcher.load(`/api/search?${params.toString()}`);
      }, 250);
    },
    [fetcher, searchType],
  );

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setValue(v);
    setOpen(true);
    doSearch(v.trim());
    setHighlightIdx(-1);
  };

  const handleSelect = (item: SearchResult) => {
    setValue(item.label);
    setOpen(false);
    setHighlightIdx(-1);
    onSelect?.(item);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showDropdown) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIdx((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && highlightIdx >= 0) {
      e.preventDefault();
      handleSelect(results[highlightIdx]);
    } else if (e.key === "Escape") {
      setOpen(false);
      setHighlightIdx(-1);
    }
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="space-y-1" ref={containerRef}>
      <label
        htmlFor={inputId}
        className={cn(
          "block text-sm font-medium",
          isDark ? "text-subtle" : "text-fg",
        )}
      >
        {label}
        {required && !hideAsterisk && (
          <span aria-hidden="true" className={cn("ml-1", isDark ? "text-danger" : "text-danger")}>
            *
          </span>
        )}
      </label>
      <div className="relative">
        {leadingIcon && (
          <span
            className={cn(
              "absolute left-3 top-1/2 -translate-y-1/2 text-subtle pointer-events-none",
              isDark && "text-muted",
            )}
          >
            {leadingIcon}
          </span>
        )}
        <input
          {...rest}
          id={inputId}
          name={name}
          type="text"
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            setOpen(true);
            doSearch(value.trim());
          }}
          autoComplete="off"
          aria-required={required}
          aria-invalid={hasError}
          aria-describedby={hasError ? descId : hint ? descId : undefined}
          className={cn(
            "w-full h-11 px-3 rounded-md border bg-surface text-fg border-border-strong placeholder:text-subtle",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:border-accent",
            "transition-colors",
            Boolean(leadingIcon) && "pl-10",
            hasError && "border-danger focus-visible:ring-danger",
            isDark && "bg-fg border-fg text-white placeholder:text-muted",
          )}
        />
        {showDropdown && (
          <div className="absolute z-50 mt-1 w-full bg-surface border border-border rounded-lg shadow-lg max-h-60 overflow-y-auto">
            {fetcher.state === "loading" && results.length === 0 && (
              <div className="px-3 py-2 text-sm text-subtle">Carregando…</div>
            )}
            {results.map((item, idx) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelect(item)}
                onMouseEnter={() => setHighlightIdx(idx)}
                className={cn(
                  "w-full text-left px-3 py-2 text-sm transition-colors",
                  idx === highlightIdx ? "bg-accent-soft-2 text-accent-strong" : "text-fg hover:bg-surface-2",
                )}
              >
                <span className="font-medium">{item.label}</span>
                {item.sublabel && (
                  <span className="ml-2 text-xs text-subtle">{item.sublabel}</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
      {hasError ? (
        <p id={descId} role="alert" className={cn("text-xs", isDark ? "text-danger" : "text-danger")}>
          {error}
        </p>
      ) : hint ? (
        <p id={descId} className={cn("text-xs", isDark ? "text-muted" : "text-muted")}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}
