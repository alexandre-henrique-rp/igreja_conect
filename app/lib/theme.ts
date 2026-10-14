/**
 * Hook & helpers de tema (light/dark/auto) — client-only.
 *
 * Estratégia:
 * - 3 valores possíveis: `"light"`, `"dark"`, `"auto"` (segue `prefers-color-scheme`).
 * - Persistência em cookie `ic-theme` para funcionar em SSR + RSC.
 * - Default: `"auto"`.
 *
 * Aplica `data-theme="light|dark"` no `<html>`. Quando `auto`, não aplica
 * atributo — deixa o media query `prefers-color-scheme` em `app.css` decidir.
 *
 * Anti-FOUC: o `<script>` inline em `root.tsx` lê o cookie e injeta o
 * atributo antes da hidratação para evitar flash de tema errado.
 */
import { useCallback, useEffect, useState } from "react";

export type ThemeMode = "light" | "dark" | "auto";

const COOKIE_NAME = "ic-theme";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 ano

export function readThemeCookie(): ThemeMode {
  if (typeof document === "undefined") return "auto";
  const match = document.cookie.match(/(?:^|;\s*)ic-theme=([^;]+)/);
  const raw = match?.[1];
  if (raw === "light" || raw === "dark" || raw === "auto") return raw;
  return "auto";
}

export function writeThemeCookie(mode: ThemeMode): void {
  if (typeof document === "undefined") return;
  document.cookie = `${COOKIE_NAME}=${mode}; path=/; max-age=${COOKIE_MAX_AGE}; samesite=lax`;
}

export function applyTheme(mode: ThemeMode): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (mode === "auto") {
    root.removeAttribute("data-theme");
  } else {
    root.setAttribute("data-theme", mode);
  }
}

export function useTheme(): {
  mode: ThemeMode;
  resolved: "light" | "dark";
  setMode: (mode: ThemeMode) => void;
  cycle: () => void;
} {
  const [mode, setModeState] = useState<ThemeMode>("auto");
  const [systemDark, setSystemDark] = useState(false);

  useEffect(() => {
    const current = readThemeCookie();
    setModeState(current);
    applyTheme(current);

    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    setSystemDark(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    writeThemeCookie(next);
    applyTheme(next);
  }, []);

  const cycle = useCallback(() => {
    setModeState((prev) => {
      const next: ThemeMode =
        prev === "light" ? "dark" : prev === "dark" ? "auto" : "light";
      writeThemeCookie(next);
      applyTheme(next);
      return next;
    });
  }, []);

  const resolved: "light" | "dark" =
    mode === "auto" ? (systemDark ? "dark" : "light") : mode;

  return { mode, resolved, setMode, cycle };
}

export function themeIcon(mode: ThemeMode): { d: string; label: string } {
  if (mode === "light")
    return {
      d: "M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z",
      label: "Tema claro",
    };
  if (mode === "dark")
    return {
      d: "M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z",
      label: "Tema escuro",
    };
  return {
    d: "M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.258V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25",
    label: "Tema automático",
  };
}