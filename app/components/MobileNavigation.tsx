import { useEffect, useRef, type RefObject } from "react";
import { useLocation } from "react-router";
import type { SessionUser } from "~/lib/session.types";
import { NavigationContent } from "./Sidebar";

/** Dados e controles necessários pelo drawer de navegação mobile. */
export type MobileNavigationProps = {
  alertasNaoLidos: number;
  isOpen: boolean;
  onClose: () => void;
  triggerRef: RefObject<HTMLButtonElement | null>;
  user: SessionUser;
};

/**
 * @description Drawer mobile acessível da navegação autenticada.
 * @param {MobileNavigationProps} props - Estado, fechamento, acionador e dados do menu.
 * @returns {JSX.Element | null} Drawer mobile quando aberto.
 */
export function MobileNavigation({
  alertasNaoLidos,
  isOpen,
  onClose,
  triggerRef,
  user,
}: MobileNavigationProps) {
  const location = useLocation();
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    drawerRef.current?.querySelector<HTMLElement>("button, a[href]")?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab" || !drawerRef.current) return;
      const focusable = Array.from(
        drawerRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      triggerRef.current?.focus();
    };
  }, [isOpen, onClose, triggerRef]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-40 lg:hidden">
      <button
        type="button"
        aria-label="Fechar menu"
        className="absolute inset-0 h-full w-full bg-slate-950/60 transition-opacity motion-reduce:transition-none"
        onClick={onClose}
      />
      <div
        ref={drawerRef}
        id="mobile-navigation"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mobile-navigation-title"
        className="relative flex h-full w-[min(20rem,85vw)] flex-col border-r border-slate-800 bg-[#0F172A] shadow-2xl transition-transform motion-reduce:transition-none"
      >
        <div className="flex min-h-20 items-center justify-between gap-3 border-b border-slate-800 px-4">
          <div>
            <h2 id="mobile-navigation-title" className="text-lg font-bold text-white">
              IgrejaConnect
            </h2>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Gestão eclesiástica
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md text-slate-300 hover:bg-slate-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
          >
            <span className="sr-only">Fechar menu</span>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <nav aria-label="Menu principal mobile" className="flex min-h-0 flex-1 flex-col">
          <NavigationContent
            alertasNaoLidos={alertasNaoLidos}
            currentPath={location.pathname}
            isMobile
            onNavigate={onClose}
            user={user}
          />
        </nav>
      </div>
    </div>
  );
}
