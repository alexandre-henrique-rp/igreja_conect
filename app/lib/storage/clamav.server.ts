/**
 * Integração com ClamAV (best-effort).
 *
 * **Padrão (training/object-storage-standard.md §5):**
 * - Cliente: `clamdjs` (Node), conecta ao daemon ClamAV via TCP.
 * - Modo daemon: `clamd` rodando como serviço no VPS.
 * - Fallback: se daemon indisponível, log warning e segue (upload NÃO trava).
 *
 * **Por que best-effort:** o projeto não tem ClamAV instalado por padrão
 * (vide `agents/AGENTS.md §Stack`). Pra dev local, skip é aceitável.
 * Em produção, instalar ClamAV + `freshclam` daily.
 */
import clamdjs from "clamdjs";
import { STORAGE_CONFIG } from "./config.server";

export interface ScanResult {
  infected: boolean;
  threat?: string;
  scanner: string;
  /** True se ClamAV está rodando e respondeu. False = skip (upload segue). */
  available: boolean;
}

/**
 * Escaneia um Buffer contra ClamAV.
 *
 * Se ClamAV não estiver disponível (`STORAGE_CONFIG.virusScan.enabled=false`
 * OU daemon offline), retorna `{ infected: false, available: false }`.
 * Caller decide se rejeita o upload ou segue sem scan.
 *
 * @throws nunca — falha de conexão retorna `{ available: false }`.
 */
export async function scanBuffer(buffer: Buffer): Promise<ScanResult> {
  if (!STORAGE_CONFIG.virusScan.enabled) {
    return { infected: false, scanner: "disabled", available: false };
  }

  try {
    const scanner = clamdjs.createScanner(
      STORAGE_CONFIG.virusScan.host,
      STORAGE_CONFIG.virusScan.port,
    );
    const result = await scanner.scanBuffer(buffer, 1024 * 1024); // 1MB chunks

    // clamdjs retorna { good: true } ou { good: false, reason }
    return {
      infected: !result.good,
      threat: result.reason,
      scanner: "clamav",
      available: true,
    };
  } catch (err) {
    // Daemon offline, timeout, etc — log e segue.
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(
      `[storage] ClamAV indisponível (${STORAGE_CONFIG.virusScan.host}:${STORAGE_CONFIG.virusScan.port}): ${msg}. Upload segue sem scan.`,
    );
    return { infected: false, scanner: "clamav-unavailable", available: false };
  }
}
